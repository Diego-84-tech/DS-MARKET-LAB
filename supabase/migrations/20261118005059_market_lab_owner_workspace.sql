-- DS Market Lab only: append-only owner instructions, per-run conversations and appreciation.
CREATE TABLE market_lab_private.instruction_entries(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, request_id uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),author text NOT NULL,
 action text NOT NULL CHECK(action IN ('apply','retire','settings','release')),
 scope text NOT NULL CHECK(scope IN ('all','A','B')),body text NOT NULL CHECK(length(body)<=12000),
 replaces bigint,data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE market_lab_private.messages(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,run_id uuid NOT NULL,agent text NOT NULL CHECK(agent IN ('A','B','rules')),
 request_id uuid NOT NULL,role text NOT NULL CHECK(role IN ('owner','assistant')),
 body text NOT NULL DEFAULT '' CHECK(length(body)<=12000),status text NOT NULL CHECK(status IN ('sent','pending','processing','waiting','complete','error')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 claim uuid,resume_at timestamptz,data jsonb NOT NULL DEFAULT '{}'::jsonb,UNIQUE(run_id,request_id,role)
);
CREATE INDEX market_lab_messages_run ON market_lab_private.messages(run_id,id);
CREATE INDEX market_lab_messages_queue ON market_lab_private.messages(status,resume_at) WHERE role='assistant';
CREATE TABLE market_lab_private.profile_feedback(run_id uuid PRIMARY KEY,agent text NOT NULL,liked boolean NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE market_lab_private.instruction_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_lab_private.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_lab_private.profile_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON market_lab_private.instruction_entries,market_lab_private.messages,market_lab_private.profile_feedback FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION market_lab_private.workspace(p_action text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r market_lab_private.runtime%ROWTYPE; own boolean; worker boolean; a jsonb; ar jsonb; rows jsonb; item jsonb; active jsonb; entry bigint; run uuid; slot text; body text; mid bigint; msg market_lab_private.messages%ROWTYPE; req uuid; current_agent boolean;
BEGIN
 SELECT * INTO r FROM market_lab_private.runtime WHERE id=true FOR UPDATE;
 own:=auth.uid()='03ea936c-ea51-416d-bf32-b6c99a1da220'::uuid;
 worker:=p_payload ? 'worker' AND encode(extensions.digest(p_payload->>'worker','sha256'),'hex')=r.worker_hash;
 IF NOT coalesce(own,false) AND NOT coalesce(worker,false) THEN RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501'; END IF;
 IF p_action='instructions' THEN
  RETURN jsonb_build_object('entries',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) FROM (SELECT * FROM market_lab_private.instruction_entries WHERE id>coalesce((p_payload->>'after')::bigint,0) ORDER BY id LIMIT 250)x),'active',coalesce(r.state->'ownerInstructions','[]'::jsonb),'settings',coalesce(r.state->'ownerPolicy','{}'::jsonb));
 END IF;
 IF p_action IN ('instruction-apply','instruction-retire','settings') THEN
  IF NOT coalesce(own,false) THEN RAISE EXCEPTION 'Owner authorization required'; END IF;
  IF r.lease_until>now() THEN RAISE EXCEPTION 'Worker busy; your draft is saved. Try again shortly.'; END IF;
  req:=(p_payload->>'requestId')::uuid;IF req IS NULL THEN RAISE EXCEPTION 'Request identity required';END IF;
  IF EXISTS(SELECT 1 FROM market_lab_private.instruction_entries WHERE request_id=req) THEN RETURN jsonb_build_object('ok',true,'duplicate',true); END IF;
  slot:=p_payload->>'scope';IF slot IS NULL OR slot NOT IN ('all','A','B') THEN RAISE EXCEPTION 'Choose an instruction target';END IF;
  active:=coalesce(r.state->'ownerInstructions','[]'::jsonb);body:=trim(coalesce(p_payload->>'text',''));
  IF p_action='instruction-apply' THEN
   IF length(body)<1 OR length(body)>4000 THEN RAISE EXCEPTION 'Instruction must contain 1 to 4000 characters';END IF;
   IF (p_payload->>'confirmed') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Review and confirm the instruction first'; END IF;
   IF length(active::text)+length(body)>16000 THEN RAISE EXCEPTION 'Active instructions are too long; retire older instructions first';END IF;
   INSERT INTO market_lab_private.instruction_entries(request_id,author,action,scope,body,data) VALUES(req,'Owner','apply',slot,body,jsonb_build_object('sourceMessage',p_payload->'sourceMessage')) RETURNING id INTO entry;
   active:=active||jsonb_build_array(jsonb_build_object('id',entry,'scope',slot,'text',body,'at',now()));
   r.state:=jsonb_set(r.state,'{ownerInstructions}',active);
  ELSIF p_action='instruction-retire' THEN
   entry:=(p_payload->>'id')::bigint;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(active)x WHERE (x->>'id')::bigint=entry) THEN RAISE EXCEPTION 'Instruction is not active';END IF;
   IF p_payload->>'confirmed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Confirm retirement first';END IF;
   INSERT INTO market_lab_private.instruction_entries(request_id,author,action,scope,body,replaces) VALUES(req,'Owner','retire',slot,coalesce(nullif(body,''),'Owner retired instruction'),entry);
   r.state:=jsonb_set(r.state,'{ownerInstructions}',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM jsonb_array_elements(active)x WHERE (x->>'id')::bigint<>entry));
  ELSE
   IF p_payload->>'confirmed' IS DISTINCT FROM 'true' OR jsonb_typeof(p_payload->'settings') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Review settings before applying';END IF;
   item:=p_payload->'settings';
   IF jsonb_typeof(item->'minimumEdge') IS DISTINCT FROM 'number' OR jsonb_typeof(item->'minimumHistory') IS DISTINCT FROM 'number' OR jsonb_typeof(item->'maximumPositions') IS DISTINCT FROM 'number' OR jsonb_typeof(item->'maximumHorizonDays') IS DISTINCT FROM 'number' OR jsonb_typeof(item->'alphaCloseMinutes') IS DISTINCT FROM 'number' OR (item->>'minimumEdge')::numeric NOT BETWEEN 0 AND 1 OR (item->>'minimumHistory')::integer NOT BETWEEN 0 AND 100 OR (item->>'maximumPositions')::integer NOT BETWEEN 1 AND 100 OR (item->>'maximumHorizonDays')::integer NOT BETWEEN 1 AND 30 OR (item->>'alphaCloseMinutes')::integer NOT BETWEEN 0 AND 14 OR jsonb_typeof(item->'alpha15Only') IS DISTINCT FROM 'boolean' OR jsonb_typeof(item->'requireExitPlan') IS DISTINCT FROM 'boolean' OR jsonb_typeof(item->'paceResearch') IS DISTINCT FROM 'boolean' OR NOT item ?& ARRAY['minimumEdge','minimumHistory','maximumPositions','maximumHorizonDays','alphaCloseMinutes','alpha15Only','requireExitPlan','paceResearch'] THEN RAISE EXCEPTION 'Invalid trading settings';END IF;
   r.state:=jsonb_set(r.state,'{ownerPolicy}',item);
   INSERT INTO market_lab_private.instruction_entries(request_id,author,action,scope,body,data) VALUES(req,'Owner','settings','all',coalesce(nullif(body,''),'Owner changed technical trading settings'),jsonb_build_object('before',coalesce((SELECT state->'ownerPolicy' FROM market_lab_private.runtime WHERE id=true),'{}'::jsonb),'after',item));
  END IF;
  UPDATE market_lab_private.runtime SET state=r.state,revision=revision+1,updated_at=now() WHERE id=true;
  INSERT INTO market_lab_private.events(data) VALUES(jsonb_build_object('type','OWNER_INSTRUCTIONS','at',now(),'detail','Owner explicitly applied an instruction change; full wording retained in Rules history.','requestId',req));
  RETURN jsonb_build_object('ok',true,'id',entry);
 END IF;
 IF p_action='release-note' THEN
  IF NOT coalesce(worker,false) THEN RAISE EXCEPTION 'Worker authorization required';END IF;
  INSERT INTO market_lab_private.instruction_entries(request_id,created_at,author,action,scope,body,data) VALUES((p_payload->>'requestId')::uuid,coalesce((p_payload->>'sourceAt')::timestamptz,now()),coalesce(p_payload->>'author','Codex'),'release','all',p_payload->>'text',coalesce(p_payload->'data','{}'::jsonb)) ON CONFLICT(request_id) DO NOTHING;RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_action='archive-source' THEN
  IF NOT coalesce(worker,false) THEN RAISE EXCEPTION 'Worker authorization required';END IF;
  SELECT snapshot INTO ar FROM market_lab_private.agent_archives WHERE id=(p_payload->>'id')::uuid;IF ar IS NULL THEN RAISE EXCEPTION 'Archive not found';END IF;
  IF p_payload->>'kind'='messages' THEN SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) INTO rows FROM (SELECT * FROM market_lab_private.messages WHERE run_id=(ar->'agent'->>'runId')::uuid AND id>coalesce((p_payload->>'after')::bigint,0) AND id<=coalesce((ar->>'conversationCut')::bigint,0) ORDER BY id LIMIT 100)x;
  ELSIF p_payload->>'kind'='instructions' THEN SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) INTO rows FROM (SELECT * FROM market_lab_private.instruction_entries WHERE id>coalesce((p_payload->>'after')::bigint,0) AND id<=coalesce((ar->>'instructionCut')::bigint,0) ORDER BY id LIMIT 100)x;
  ELSE RAISE EXCEPTION 'Unknown archive workspace source';END IF;RETURN jsonb_build_object('rows',rows);
 END IF;
 IF p_action='chat-claim' THEN
  IF NOT coalesce(worker,false) THEN RAISE EXCEPTION 'Worker authorization required';END IF;
  IF r.lease_until>now() THEN RETURN jsonb_build_object('busy',true);END IF;
  UPDATE market_lab_private.messages SET status='error',body='This reply was interrupted. It was not automatically retried; you may send a new message.',updated_at=now() WHERE status='processing' AND updated_at<now()-interval '5 minutes';
  SELECT * INTO msg FROM market_lab_private.messages WHERE role='assistant' AND status IN ('pending','waiting') AND (resume_at IS NULL OR resume_at<=now()) ORDER BY id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('idle',true);END IF;
  UPDATE market_lab_private.messages SET status='processing',claim=extensions.gen_random_uuid(),updated_at=now() WHERE id=msg.id RETURNING * INTO msg;
  RETURN to_jsonb(msg);
 END IF;
 IF p_action IN ('chat-complete','chat-defer') THEN
  IF NOT coalesce(worker,false) THEN RAISE EXCEPTION 'Worker authorization required';END IF;
  SELECT * INTO msg FROM market_lab_private.messages WHERE id=(p_payload->>'id')::bigint FOR UPDATE;
  IF NOT FOUND OR msg.status<>'processing' OR msg.claim::text IS DISTINCT FROM p_payload->>'claim' THEN RAISE EXCEPTION 'Reply claim expired';END IF;
  IF p_action='chat-defer' THEN UPDATE market_lab_private.messages SET status='waiting',body=left(coalesce(p_payload->>'reason','Waiting for worker'),500),resume_at=coalesce((p_payload->>'resumeAt')::timestamptz,now()+interval '30 seconds'),updated_at=now() WHERE id=msg.id;
  ELSE
   IF p_payload->>'status' NOT IN ('complete','error') OR length(coalesce(p_payload->>'text',''))>12000 THEN RAISE EXCEPTION 'Invalid reply';END IF;
   UPDATE market_lab_private.messages SET status=p_payload->>'status',body=coalesce(p_payload->>'text','Reply unavailable'),data=coalesce(p_payload->'data','{}'::jsonb),updated_at=now() WHERE id=msg.id;
  END IF;RETURN jsonb_build_object('ok',true);
 END IF;
 -- Remaining actions address a single current or archived agent run.
 run:=(p_payload->>'runId')::uuid;slot:=p_payload->>'agent';
 IF slot='rules' AND run='00000000-0000-4000-8000-000000000001'::uuid THEN a:=jsonb_build_object('id','rules','displayName','Instruction discussion');current_agent:=true;
 ELSE
  SELECT x INTO a FROM jsonb_array_elements(r.state->'agents')x WHERE x->>'runId'=run::text AND x->>'id'=slot;current_agent:=a IS NOT NULL;
  IF a IS NULL THEN SELECT snapshot->'agent' INTO a FROM market_lab_private.agent_archives WHERE run_id=run AND agent=slot;END IF;
 END IF;
 IF a IS NULL THEN RAISE EXCEPTION 'Agent run not found';END IF;
 IF p_action='messages' THEN
  IF p_payload->>'mode'='all' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) INTO rows FROM (SELECT * FROM market_lab_private.messages WHERE run_id=run AND id>coalesce((p_payload->>'after')::bigint,0) ORDER BY id LIMIT 100)x;
  ELSE
   SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) INTO rows FROM (SELECT * FROM market_lab_private.messages WHERE run_id=run AND id<coalesce((p_payload->>'before')::bigint,9223372036854775807) ORDER BY id DESC LIMIT 100)x;
  END IF;
  RETURN jsonb_build_object('messages',rows,'hasOlder',EXISTS(SELECT 1 FROM market_lab_private.messages WHERE run_id=run AND id<coalesce((rows->0->>'id')::bigint,0)),'agent',a,'readOnly',NOT current_agent OR (slot<>'rules' AND a->>'lifecycle'<>'active'));
 END IF;
 IF p_action='like' THEN
  IF NOT coalesce(own,false) OR NOT current_agent OR slot='rules' OR a->>'lifecycle'<>'active' THEN RAISE EXCEPTION 'Only a current agent can receive feedback';END IF;
  IF r.lease_until>now() THEN RAISE EXCEPTION 'Worker busy; try again shortly';END IF;
  IF jsonb_typeof(p_payload->'liked') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Choose like or unlike';END IF;
  INSERT INTO market_lab_private.profile_feedback(run_id,agent,liked) VALUES(run,slot,(p_payload->>'liked')::boolean) ON CONFLICT(run_id) DO UPDATE SET liked=excluded.liked,updated_at=now();
  SELECT coalesce(jsonb_agg(CASE WHEN x->>'runId'=run::text THEN jsonb_set(x,'{ownerAppreciation}',jsonb_build_object('liked',p_payload->'liked','at',now())) ELSE x END),'[]'::jsonb) INTO active FROM jsonb_array_elements(r.state->'agents')x;
  UPDATE market_lab_private.runtime SET state=jsonb_set(r.state,'{agents}',active),revision=revision+1,updated_at=now() WHERE id=true;
  INSERT INTO market_lab_private.events(data) VALUES(jsonb_build_object('type','OWNER_APPRECIATION','agent',slot,'runId',run,'liked',p_payload->'liked','at',now(),'detail','Owner updated profile appreciation; no cash or permissions changed.'));RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_action='message-cancel' THEN
  IF NOT coalesce(own,false) OR NOT current_agent THEN RAISE EXCEPTION 'Only current-run pending replies can be cancelled';END IF;
  UPDATE market_lab_private.messages SET status='error',body='Owner cancelled this queued reply. Original message remains saved.',updated_at=now() WHERE id=(p_payload->>'id')::bigint AND run_id=run AND role='assistant' AND status IN ('pending','waiting');
  IF NOT FOUND THEN RAISE EXCEPTION 'Reply is already processing or finished';END IF;RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_action='message-send' THEN
  IF NOT coalesce(own,false) OR NOT current_agent OR (slot<>'rules' AND a->>'lifecycle'<>'active') THEN RAISE EXCEPTION 'Archived or retiring conversations are read-only';END IF;
  body:=trim(coalesce(p_payload->>'text',''));IF length(body)<1 OR length(body)>4000 THEN RAISE EXCEPTION 'Message must contain 1 to 4000 characters';END IF;
  req:=(p_payload->>'requestId')::uuid;IF req IS NULL THEN RAISE EXCEPTION 'Request identity required';END IF;
  IF EXISTS(SELECT 1 FROM market_lab_private.messages WHERE run_id=run AND request_id=req) THEN RETURN jsonb_build_object('ok',true,'duplicate',true);END IF;
  IF EXISTS(SELECT 1 FROM market_lab_private.messages WHERE run_id=run AND role='assistant' AND status IN ('pending','processing','waiting')) THEN RAISE EXCEPTION 'Wait for the current reply before sending another message';END IF;
  IF (SELECT count(*) FROM market_lab_private.messages WHERE role='owner' AND created_at>now()-interval '1 minute')>=10 THEN RAISE EXCEPTION 'Please wait before sending more messages';END IF;
  INSERT INTO market_lab_private.messages(run_id,agent,request_id,role,body,status) VALUES(run,slot,req,'owner',body,'sent'),(run,slot,req,'assistant','','pending');RETURN jsonb_build_object('ok',true);
 END IF;
 RAISE EXCEPTION 'Unknown workspace action';
END $$;
REVOKE ALL ON FUNCTION market_lab_private.workspace(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION market_lab_private.workspace(text,jsonb) TO anon,authenticated;
CREATE FUNCTION public.market_lab_workspace(p_action text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT market_lab_private.workspace(p_action,p_payload);$$;
REVOKE ALL ON FUNCTION public.market_lab_workspace(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_lab_workspace(text,jsonb) TO anon,authenticated;
-- Freeze a conversation cutoff when a run is archived; prevent a half-finished reply from being lost.
CREATE FUNCTION market_lab_private.freeze_workspace() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM market_lab_private.messages WHERE run_id=NEW.run_id AND status IN ('pending','processing','waiting')) THEN RAISE EXCEPTION 'Waiting for saved agent reply before archiving';END IF;
 NEW.snapshot:=NEW.snapshot||jsonb_build_object('conversationCut',(SELECT coalesce(max(id),0) FROM market_lab_private.messages WHERE run_id=NEW.run_id),'instructionCut',(SELECT coalesce(max(id),0) FROM market_lab_private.instruction_entries),'ownerInstructions',(SELECT state->'ownerInstructions' FROM market_lab_private.runtime WHERE id=true),'ownerPolicy',(SELECT state->'ownerPolicy' FROM market_lab_private.runtime WHERE id=true));RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION market_lab_private.freeze_workspace() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER market_lab_freeze_workspace BEFORE INSERT ON market_lab_private.agent_archives FOR EACH ROW EXECUTE FUNCTION market_lab_private.freeze_workspace();

