-- Additive, owner-isolated agent archives. No existing records are removed.
ALTER TABLE market_lab_private.frames ADD COLUMN IF NOT EXISTS recorded_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS market_lab_private.agent_archives(
 id uuid PRIMARY KEY, agent text NOT NULL CHECK(agent IN ('A','B')), run_id uuid NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'building' CHECK(status IN ('building','verified')),
 snapshot jsonb NOT NULL, source_cut bigint NOT NULL, frozen_at timestamptz NOT NULL,
 summary jsonb NOT NULL, checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb, manifest jsonb,
 lease text, lease_until timestamptz, activated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS market_lab_private.archive_markets(
 archive_id uuid NOT NULL REFERENCES market_lab_private.agent_archives(id),ticker text NOT NULL,metadata jsonb NOT NULL,
 PRIMARY KEY(archive_id,ticker)
);
ALTER TABLE market_lab_private.agent_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_lab_private.archive_markets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON market_lab_private.agent_archives,market_lab_private.archive_markets FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION market_lab_private.tag_agent_run() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a jsonb; slot text;
BEGIN
 slot:=coalesce(NEW.data->>'agent',NEW.data->'application'->>'agent');
 IF slot IN ('A','B') AND NOT NEW.data ? 'runId' THEN
  SELECT x INTO a FROM market_lab_private.runtime r CROSS JOIN LATERAL jsonb_array_elements(r.state->'agents')x WHERE x->>'id'=slot AND r.id=true;
  IF a->>'runId' IS NOT NULL THEN NEW.data:=NEW.data||jsonb_build_object('runId',a->>'runId'); END IF;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION market_lab_private.tag_agent_run() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS market_lab_event_run ON market_lab_private.events;
CREATE TRIGGER market_lab_event_run BEFORE INSERT ON market_lab_private.events FOR EACH ROW EXECUTE FUNCTION market_lab_private.tag_agent_run();
CREATE OR REPLACE FUNCTION market_lab_private.archive_belongs(e jsonb,slot text,run text,original boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT coalesce(e->>'agent',e->'application'->>'agent')=slot AND (e->>'runId'=run OR (original AND e->>'runId' IS NULL)); $$;
REVOKE ALL ON FUNCTION market_lab_private.archive_belongs(jsonb,text,text,boolean) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION market_lab_private.archives(p_action text,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r market_lab_private.runtime%ROWTYPE; ar market_lab_private.agent_archives%ROWTYPE; a jsonb; fresh jsonb; idx integer; own boolean; worker boolean; rows jsonb; cut bigint; job uuid; original boolean; slot text; query_kind text; total bigint; next_state jsonb;
BEGIN
 SELECT * INTO r FROM market_lab_private.runtime WHERE id=true FOR UPDATE;
 own:=auth.uid()='03ea936c-ea51-416d-bf32-b6c99a1da220'::uuid;
 worker:=p_payload ? 'worker' AND encode(extensions.digest(p_payload->>'worker','sha256'),'hex')=r.worker_hash;
 IF NOT coalesce(own,false) AND NOT coalesce(worker,false) THEN RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501'; END IF;
 IF p_action='list' THEN
  RETURN jsonb_build_object('archives',(SELECT coalesce(jsonb_agg(x.summary||jsonb_build_object('id',x.id,'status',x.status,'progress',x.checkpoint->'phase','activatedAt',x.activated_at) ORDER BY x.created_at DESC),'[]'::jsonb) FROM market_lab_private.agent_archives x));
 END IF;
 IF p_action='detail' THEN
  SELECT * INTO ar FROM market_lab_private.agent_archives WHERE id=(p_payload->>'id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Archive not found'; END IF;
  RETURN jsonb_build_object('id',ar.id,'status',ar.status,'summary',ar.summary,'manifest',ar.manifest,'agent',ar.snapshot->'agent','rules',ar.snapshot->'rules','activatedAt',ar.activated_at);
 END IF;
 IF NOT coalesce(worker,false) THEN RAISE EXCEPTION 'Worker authorization required' USING ERRCODE='42501'; END IF;
 IF p_action='begin' THEN
  IF r.lease_until>now() THEN RETURN jsonb_build_object('busy',true); END IF;
  SELECT value,(ordinality-1)::integer INTO a,idx FROM jsonb_array_elements(r.state->'agents') WITH ORDINALITY WHERE value->>'lifecycle'='retiring' AND jsonb_array_length(value->'positions')=0 AND jsonb_array_length(value->'orders')=0 AND jsonb_array_length(value->'loans')=0 ORDER BY ordinality LIMIT 1;
  IF a IS NULL THEN RETURN jsonb_build_object('idle',true); END IF;
  IF jsonb_array_length(a->'positions')<>0 OR jsonb_array_length(a->'orders')<>0 OR jsonb_array_length(a->'loans')<>0 THEN RETURN jsonb_build_object('waiting',true,'agent',a->>'id'); END IF;
  IF a->>'runId' IS NULL THEN RAISE EXCEPTION 'Run identity is required before archive'; END IF;
  job:=(a->'replacement'->>'id')::uuid;slot:=a->>'id';original:=coalesce((a->>'runNumber')::integer,1)=1;
  SELECT coalesce(max(id),0) INTO cut FROM market_lab_private.events;
  INSERT INTO market_lab_private.agent_archives(id,agent,run_id,snapshot,source_cut,frozen_at,summary)
  VALUES(job,slot,(a->>'runId')::uuid,jsonb_build_object('agent',a,'rules',r.state->'rules','policyVersion',r.state->'policyVersion','startedAt',r.state->>'startedAt','endsAt',r.state->>'endsAt','notes',(SELECT coalesce(jsonb_agg(n),'[]'::jsonb) FROM jsonb_array_elements(r.state->'notes')n WHERE n->>'agent'=slot),'checkpoints',r.state->'checkpoints','forecastReview',r.state->'forecastReview'),cut,now(),jsonb_build_object('agentId',slot,'appId',a->>'appId','name',coalesce(a->>'displayName',a->>'name'),'role',a->>'role','runId',a->>'runId','runNumber',a->'runNumber','runStartedAt',a->>'runStartedAt','archivedAt',now(),'finalCash',a->'cash','realized',a->'realized','fees',a->'fees','interestPaid',a->'interestPaid','ownerCredits',a->'ownerCredits','achievements',a->'achievements','reason',a->'replacement'->>'reason'))
  ON CONFLICT(run_id) DO NOTHING;
  SELECT id INTO job FROM market_lab_private.agent_archives WHERE run_id=(a->>'runId')::uuid;
  INSERT INTO market_lab_private.archive_markets(archive_id,ticker,metadata)
  SELECT job,t.ticker,coalesce(m.metadata,jsonb_build_object('ticker',t.ticker,'historyUnavailable',true)) FROM
   (SELECT DISTINCT coalesce(e.data->>'market',e.data->'order'->>'market',e.data->'decision'->>'market') AS ticker FROM market_lab_private.events e WHERE e.id<=cut AND market_lab_private.archive_belongs(e.data,slot,a->>'runId',original))t
   LEFT JOIN market_lab_private.recordings m ON m.ticker=t.ticker WHERE t.ticker IS NOT NULL AND t.ticker<>'' ON CONFLICT DO NOTHING;
  a:=jsonb_set(a,'{lifecycle}','"archiving"'::jsonb);a:=jsonb_set(a,'{replacement,status}','"building"'::jsonb);
  UPDATE market_lab_private.runtime SET state=jsonb_set(r.state,ARRAY['agents',idx::text],a),revision=revision+1,updated_at=now() WHERE id=true;
  INSERT INTO market_lab_private.events(data) VALUES(jsonb_build_object('type','ARCHIVE_BEGIN','agent',slot,'runId',a->>'runId','archiveId',job,'at',now(),'detail','Agent frozen for verified archive; the other profile is unaffected.'));
  RETURN jsonb_build_object('id',job);
 END IF;
 IF p_action='claim' THEN
  SELECT * INTO ar FROM market_lab_private.agent_archives WHERE activated_at IS NULL AND (lease_until IS NULL OR lease_until<=now()) ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('idle',true); END IF;
  UPDATE market_lab_private.agent_archives SET lease=extensions.gen_random_uuid()::text,lease_until=now()+interval '4 minutes' WHERE id=ar.id RETURNING * INTO ar;
  RETURN jsonb_build_object('id',ar.id,'status',ar.status,'snapshot',ar.snapshot,'summary',ar.summary,'checkpoint',ar.checkpoint,'lease',ar.lease,'frozenAt',ar.frozen_at,'sourceCut',ar.source_cut);
 END IF;
 SELECT * INTO ar FROM market_lab_private.agent_archives WHERE id=(p_payload->>'id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Archive not found'; END IF;
 a:=ar.snapshot->'agent';slot:=ar.agent;original:=coalesce((a->>'runNumber')::integer,1)=1;
 IF p_action='source' THEN
  query_kind:=p_payload->>'kind';
  IF query_kind='events' THEN
   SELECT coalesce(jsonb_agg(x.data||jsonb_build_object('recordId',x.id) ORDER BY x.id),'[]'::jsonb) INTO rows FROM (SELECT e.id,e.data FROM market_lab_private.events e WHERE e.id>coalesce((p_payload->>'after')::bigint,0) AND e.id<=ar.source_cut AND market_lab_private.archive_belongs(e.data,slot,ar.run_id::text,original) ORDER BY e.id LIMIT 250)x;
  ELSIF query_kind='markets' THEN
   SELECT coalesce(jsonb_agg(x.metadata ORDER BY x.ticker),'[]'::jsonb) INTO rows FROM (SELECT ticker,metadata FROM market_lab_private.archive_markets WHERE archive_id=ar.id AND ticker>coalesce(p_payload->>'after','') ORDER BY ticker LIMIT 250)x;
  ELSIF query_kind='frames' THEN
   IF NOT EXISTS(SELECT 1 FROM market_lab_private.archive_markets WHERE archive_id=ar.id AND ticker=p_payload->>'ticker') THEN RAISE EXCEPTION 'Market outside archive'; END IF;
   SELECT coalesce(jsonb_agg(x.data||jsonb_build_object('source',x.source,'at',x.at) ORDER BY x.at,x.source),'[]'::jsonb) INTO rows FROM (SELECT f.at,f.source,f.data FROM market_lab_private.frames f WHERE f.ticker=p_payload->>'ticker' AND f.recorded_at<=ar.frozen_at AND f.at<=ar.frozen_at AND f.at>=coalesce((a->>'runStartedAt')::timestamptz,'epoch'::timestamptz)-interval '1 hour' AND (f.at,f.source)>(coalesce((p_payload->>'afterAt')::timestamptz,'epoch'::timestamptz),coalesce(p_payload->>'afterSource','')) ORDER BY f.at,f.source LIMIT 1000)x;
  ELSIF query_kind='snapshots' THEN
   SELECT coalesce(jsonb_agg(x.data ORDER BY x.minute),'[]'::jsonb) INTO rows FROM (SELECT minute,jsonb_build_object('minute',minute,'account',(SELECT v FROM jsonb_array_elements(s.data->'accounts')v WHERE v->>'id'=slot)) AS data FROM market_lab_private.snapshots s WHERE s.minute>=coalesce((a->>'runStartedAt')::timestamptz,'epoch'::timestamptz) AND s.minute<=ar.frozen_at AND s.minute>coalesce((p_payload->>'after')::timestamptz,'epoch'::timestamptz) ORDER BY s.minute LIMIT 500)x;
  ELSE RAISE EXCEPTION 'Unknown archive source'; END IF;
  RETURN jsonb_build_object('rows',rows);
 END IF;
 IF ar.lease IS DISTINCT FROM p_payload->>'lease' OR ar.lease_until<=now() THEN RAISE EXCEPTION 'Archive lease expired'; END IF;
 IF p_action='progress' THEN
  IF ar.status<>'building' THEN RAISE EXCEPTION 'Verified archives are immutable'; END IF;
  IF pg_column_size(p_payload->'checkpoint')>1000000 THEN RAISE EXCEPTION 'Checkpoint too large'; END IF;
  UPDATE market_lab_private.agent_archives SET checkpoint=p_payload->'checkpoint',lease_until=now()+interval '4 minutes' WHERE id=ar.id;
  RETURN jsonb_build_object('ok',true);
 ELSIF p_action='verify' THEN
  IF ar.status='verified' THEN RETURN jsonb_build_object('ok',true); END IF;
  IF p_payload->'manifest'->>'verified' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Verification required'; END IF;
  UPDATE market_lab_private.agent_archives SET status='verified',manifest=p_payload->'manifest',checkpoint=jsonb_build_object('phase','verified'),lease_until=now()+interval '4 minutes' WHERE id=ar.id;
  RETURN jsonb_build_object('ok',true);
 ELSIF p_action='activate' THEN
  IF ar.activated_at IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'alreadyActivated',true); END IF;
  IF ar.status<>'verified' THEN RAISE EXCEPTION 'Archive must be verified before replacement'; END IF;
  IF r.lease_until>now() THEN RETURN jsonb_build_object('busy',true); END IF;
  SELECT value,(ordinality-1)::integer INTO a,idx FROM jsonb_array_elements(r.state->'agents') WITH ORDINALITY WHERE value->>'id'=slot;
  IF a->>'runId'<>ar.run_id::text OR a->>'lifecycle'<>'archiving' THEN RAISE EXCEPTION 'Current agent changed'; END IF;
  fresh:=p_payload->'agent';IF fresh->>'runId' IS NOT NULL THEN PERFORM (fresh->>'runId')::uuid;END IF;
  IF fresh IS NULL OR NOT fresh ?& ARRAY['id','appId','runId','start','cash','positions','loans','orders','lifecycle'] OR fresh->>'runId' IS NULL OR jsonb_typeof(fresh->'positions') IS DISTINCT FROM 'array' OR jsonb_typeof(fresh->'orders') IS DISTINCT FROM 'array' OR jsonb_typeof(fresh->'loans') IS DISTINCT FROM 'array' OR jsonb_typeof(fresh->'cash') IS DISTINCT FROM 'number' OR jsonb_typeof(fresh->'start') IS DISTINCT FROM 'number' OR fresh->>'id' IS DISTINCT FROM slot OR fresh->>'appId' IS DISTINCT FROM a->>'appId' OR fresh->>'runId'=a->>'runId' OR (fresh->>'start')::integer<>(a->'replacement'->>'startingCash')::integer OR fresh->'cash'<>fresh->'start' OR jsonb_array_length(fresh->'positions')<>0 OR jsonb_array_length(fresh->'loans')<>0 OR jsonb_array_length(fresh->'orders')<>0 OR fresh->>'lifecycle' IS DISTINCT FROM 'onboarding' THEN RAISE EXCEPTION 'Invalid new agent'; END IF;
  next_state:=jsonb_set(r.state,ARRAY['agents',idx::text],fresh);
  next_state:=jsonb_set(next_state,'{notes}',(SELECT coalesce(jsonb_agg(n),'[]'::jsonb) FROM jsonb_array_elements(next_state->'notes')n WHERE n->>'agent' IS DISTINCT FROM slot));
  next_state:=jsonb_set(next_state,'{reviewForecasts}',(SELECT coalesce(jsonb_agg(n),'[]'::jsonb) FROM jsonb_array_elements(coalesce(next_state->'reviewForecasts','[]'::jsonb))n WHERE n->>'agent' IS DISTINCT FROM slot));
  UPDATE market_lab_private.runtime SET state=next_state,revision=revision+1,updated_at=now() WHERE id=true;
  UPDATE market_lab_private.agent_archives SET activated_at=now(),lease=NULL,lease_until=NULL WHERE id=ar.id;
  INSERT INTO market_lab_private.events(data) VALUES(jsonb_build_object('type','ARCHIVE_COMPLETE','agent',slot,'runId',ar.run_id,'archiveId',ar.id,'at',now(),'detail','Verified immutable archive completed before replacement.')),(jsonb_build_object('type','AGENT_STARTED','agent',slot,'runId',fresh->>'runId','archiveId',ar.id,'at',now(),'startingCapital',fresh->'start','detail','New run funded separately; lifetime trading counters start at zero. Owner-approved initial capital is not trading income.'));
  RETURN jsonb_build_object('ok',true);
 ELSE RAISE EXCEPTION 'Unknown archive action'; END IF;
END $$;
REVOKE ALL ON FUNCTION market_lab_private.archives(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION market_lab_private.archives(text,jsonb) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.market_lab_archives(p_action text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT market_lab_private.archives(p_action,p_payload); $$;
REVOKE ALL ON FUNCTION public.market_lab_archives(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_lab_archives(text,jsonb) TO anon,authenticated;
