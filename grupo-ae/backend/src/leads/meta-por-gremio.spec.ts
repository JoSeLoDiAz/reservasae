import { configDeMeta, loQueFalta, nombreDeVariable } from './meta-por-gremio';

/// Lo que cuidan estas pruebas: que la configuracion de un
/// gremio NO se mezcle con la del otro.
///
/// Con una app de Meta por gremio, cada una firma con su
/// propio secreto. Si el codigo coge el secreto equivocado,
/// Meta manda los leads y nosotros los rechazamos todos por
/// «firma invalida» -- y eso no se ve como un error de
/// configuracion, se ve como que Meta no manda nada. Es el
/// fallo mas caro de diagnosticar de los que caben aqui.

describe('el nombre de la variable', () => {
  it('el guion del slug pasa a raya baja', () => {
    // britcham-adee no vale como nombre de variable
    expect(nombreDeVariable('META_APP_SECRET', 'britcham-adee')).toBe(
      'META_APP_SECRET_BRITCHAM_ADEE',
    );
  });

  it('un slug sin guion sale igual, en mayusculas', () => {
    expect(nombreDeVariable('META_VERIFY_TOKEN', 'adecopria')).toBe(
      'META_VERIFY_TOKEN_ADECOPRIA',
    );
  });
});

describe('cada gremio lee LO SUYO', () => {
  const env = {
    META_APP_SECRET_ADECOPRIA: 'secreto-ade',
    META_VERIFY_TOKEN_ADECOPRIA: 'token-ade',
    META_APP_SECRET_BRITCHAM_ADEE: 'secreto-bri',
    META_VERIFY_TOKEN_BRITCHAM_ADEE: 'token-bri',
  } as NodeJS.ProcessEnv;

  it('adecopria coge el de adecopria', () => {
    expect(configDeMeta('adecopria', env).appSecret).toBe('secreto-ade');
  });

  it('britcham coge el de britcham', () => {
    expect(configDeMeta('britcham-adee', env).appSecret).toBe('secreto-bri');
  });

  it('y NUNCA se cruzan', () => {
    // este es el fallo que se paga carisimo: verificar la firma
    // de un gremio con el secreto del otro rechaza todos sus
    // leads y parece que Meta no manda nada
    const ade = configDeMeta('adecopria', env);
    const bri = configDeMeta('britcham-adee', env);
    expect(ade.appSecret).not.toBe(bri.appSecret);
    expect(ade.verifyToken).not.toBe(bri.verifyToken);
  });
});

describe('sin respaldo a las variables sueltas', () => {
  it('la vieja META_APP_SECRET NO sirve para ningun gremio', () => {
    // un respaldo haria que el gremio mal configurado usara el
    // secreto del otro, y el fallo volveria a ser silencioso
    const env = {
      META_APP_SECRET: 'la-vieja',
      META_VERIFY_TOKEN: 'el-viejo',
    } as NodeJS.ProcessEnv;
    const c = configDeMeta('adecopria', env);
    expect(c.appSecret).toBeNull();
    expect(c.verifyToken).toBeNull();
  });
});

describe('se dice QUE falta, no solo que algo falta', () => {
  it('sin nada, faltan las dos y se nombran', () => {
    const falta = loQueFalta(configDeMeta('adecopria', {} as NodeJS.ProcessEnv));
    expect(falta).toHaveLength(2);
    expect(falta.join(' ')).toContain('META_APP_SECRET_ADECOPRIA');
    expect(falta.join(' ')).toContain('META_VERIFY_TOKEN_ADECOPRIA');
  });

  it('con el secreto puesto, solo falta el token', () => {
    const env = { META_APP_SECRET_ADECOPRIA: 'x' } as NodeJS.ProcessEnv;
    const falta = loQueFalta(configDeMeta('adecopria', env));
    expect(falta).toHaveLength(1);
    expect(falta[0]).toContain('VERIFY_TOKEN');
  });

  it('completo no falta nada', () => {
    const env = {
      META_APP_SECRET_ADECOPRIA: 'x',
      META_VERIFY_TOKEN_ADECOPRIA: 'y',
    } as NodeJS.ProcessEnv;
    expect(loQueFalta(configDeMeta('adecopria', env))).toHaveLength(0);
  });

  it('cada mensaje dice el nombre EXACTO de su variable', () => {
    // «falta el secreto de Meta» obliga a ir a buscar como se
    // llama; el nombre completo se copia y se pega
    const falta = loQueFalta(
      configDeMeta('britcham-adee', {} as NodeJS.ProcessEnv),
    );
    expect(falta[0]).toContain('META_APP_SECRET_BRITCHAM_ADEE');
  });
});
