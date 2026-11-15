-- Additive Market Lab isolation. Never changes existing DS HUB accounts or app tables.
CREATE SCHEMA IF NOT EXISTS market_lab_private;
REVOKE ALL ON SCHEMA market_lab_private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS market_lab_private.runtime (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), state jsonb NOT NULL, revision bigint NOT NULL DEFAULT 0,
 worker_hash text NOT NULL, lease text, lease_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS market_lab_private.events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS market_lab_private.snapshots (
 minute timestamptz PRIMARY KEY, data jsonb NOT NULL
);
ALTER TABLE market_lab_private.runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_lab_private.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_lab_private.snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA market_lab_private FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION market_lab_private.gateway(p_action text,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r market_lab_private.runtime%ROWTYPE; own boolean; worker boolean; item jsonb; s jsonb; out jsonb;
BEGIN
 SELECT * INTO r FROM market_lab_private.runtime WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Market Lab not initialized'; END IF;
 own := auth.uid()='03ea936c-ea51-416d-bf32-b6c99a1da220'::uuid;
 worker := p_payload ? 'worker' AND encode(extensions.digest(p_payload->>'worker','sha256'),'hex')=r.worker_hash;
 IF p_action='history' THEN
  IF NOT coalesce(own,false) THEN RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('events',(SELECT coalesce(jsonb_agg(x.data||jsonb_build_object('recordId',x.id) ORDER BY x.id),'[]'::jsonb) FROM (SELECT id,data FROM market_lab_private.events WHERE id>coalesce((p_payload->>'after')::bigint,0) ORDER BY id LIMIT 500)x));
 END IF;
 IF p_action='read' THEN
  IF NOT coalesce(own,false) AND NOT coalesce(worker,false) THEN RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(x.data ORDER BY x.id DESC),'[]'::jsonb) INTO out FROM (SELECT id,data FROM market_lab_private.events ORDER BY id DESC LIMIT 120)x;
  RETURN jsonb_build_object('state',r.state,'revision',r.revision,'events',out,'databaseBytes',pg_catalog.pg_database_size(pg_catalog.current_database()),'snapshots',(SELECT coalesce(jsonb_agg(x.data ORDER BY x.minute),'[]'::jsonb) FROM (SELECT minute,data FROM market_lab_private.snapshots ORDER BY minute DESC LIMIT 120)x));
 END IF;
 IF NOT coalesce(worker,false) THEN RAISE EXCEPTION 'Worker authorization required' USING ERRCODE='42501'; END IF;
 IF p_action='lease' THEN
  IF r.lease_until>now() THEN RETURN jsonb_build_object('busy',true); END IF;
  UPDATE market_lab_private.runtime SET lease=extensions.gen_random_uuid()::text,lease_until=now()+interval '4 minutes' WHERE id=true RETURNING * INTO r;
  RETURN jsonb_build_object('state',r.state,'revision',r.revision,'lease',r.lease,'databaseBytes',pg_catalog.pg_database_size(pg_catalog.current_database()));
 END IF;
 IF p_action='commit' THEN
  IF r.lease IS DISTINCT FROM p_payload->>'lease' OR r.lease_until<=now() OR r.revision<>(p_payload->>'revision')::bigint THEN RAISE EXCEPTION 'Stale worker lease'; END IF;
  s:=p_payload->'state';
  IF s->>'version'<>'0.4.1' OR jsonb_array_length(s->'agents')<>2 OR pg_column_size(s)>200000 THEN RAISE EXCEPTION 'Invalid state'; END IF;
  UPDATE market_lab_private.runtime SET state=s,revision=revision+1,updated_at=now(),lease=CASE WHEN coalesce((p_payload->>'release')::boolean,true) THEN NULL ELSE lease END,lease_until=CASE WHEN coalesce((p_payload->>'release')::boolean,true) THEN NULL ELSE now()+interval '4 minutes' END WHERE id=true RETURNING * INTO r;
  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'events','[]'::jsonb)) LOOP
   IF pg_column_size(item)>12000 THEN RAISE EXCEPTION 'Oversized event'; END IF;
   INSERT INTO market_lab_private.events(data) VALUES(item||jsonb_build_object('at',coalesce(item->>'at',now()::text)));
  END LOOP;
  IF p_payload ? 'snapshot' THEN INSERT INTO market_lab_private.snapshots(minute,data) VALUES(date_trunc('minute',now()),p_payload->'snapshot') ON CONFLICT(minute) DO NOTHING; END IF;
  -- Bounded chart history only. Financial and decision events are not purged here.
  DELETE FROM market_lab_private.snapshots WHERE minute<now()-interval '7 days';
  RETURN jsonb_build_object('revision',r.revision,'lease',r.lease);
 END IF;
 RAISE EXCEPTION 'Unknown Market Lab action';
END $$;
REVOKE ALL ON FUNCTION market_lab_private.gateway(text,jsonb) FROM PUBLIC;
GRANT USAGE ON SCHEMA market_lab_private TO anon,authenticated;
GRANT EXECUTE ON FUNCTION market_lab_private.gateway(text,jsonb) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.market_lab_gateway(p_action text,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT market_lab_private.gateway(p_action,p_payload);
$$;
REVOKE ALL ON FUNCTION public.market_lab_gateway(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_lab_gateway(text,jsonb) TO anon,authenticated;
