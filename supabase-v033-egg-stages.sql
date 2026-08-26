-- Buhrsi's v0.33 – zehn Ei-Stufen bis 200 Energie
-- Preserve the current function bodies and update only the energy cap/readiness threshold.

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.complete_child_brushing_v024(uuid,text,integer)'::regprocedure)
    into function_definition;
  execute replace(
    function_definition,
    'egg_energy=least(100,egg_energy+egg_gain)',
    'egg_energy=least(200,egg_energy+egg_gain)'
  );

  select pg_get_functiondef('public.hatch_ready_egg(uuid)'::regprocedure)
    into function_definition;
  execute replace(
    function_definition,
    'if c.egg_energy < 100 then',
    'if c.egg_energy < 200 then'
  );

  select pg_get_functiondef('public.buhrsi_child_hatch_ready_egg(uuid,text)'::regprocedure)
    into function_definition;
  execute replace(
    function_definition,
    'if c.egg_energy < 100 then',
    'if c.egg_energy < 200 then'
  );
end
$$;
