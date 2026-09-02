/** Los mismos datos, dichos por tres sitios distintos. */

/**
 * Una persona puede haber dicho lo suyo tres veces: al llenar el
 * formulario de la pauta, al inscribirse en el nuestro, y el RUI
 * lo dice por su cuenta desde el registro del Estado.
 *
 * Los tres registros se quedan, y ninguno pisa a los otros. El
 * asesor los ve al lado y decide campo por campo — que es lo que
 * ya hacía el comparativo del nombre con el RUI, extendido a
 * todos los datos y a las tres fuentes.
 *
 * MANDA LA FICHA, que es lo guardado. Las otras dos son lo que
 * dijeron en otro momento: no se aplican solas ni siquiera cuando
 * la ficha tiene el hueco vacío. Rellenar por nuestra cuenta un
 * dato que llegó por un anuncio de Facebook es decidir por la
 * persona sin que nadie lo mire — y aquí eso se administra
 * estricto.
 *
 * DEL RUI SOLO SE TRAE, NUNCA SE MANDA. Es el registro legal del
 * Estado: no es nuestro para corregirlo. Entre ficha y lead sí va
 * en los dos sentidos.
 */

import { Injectable, NotFoundException } from '@nestjs/common';

import {
  DEPARTAMENTO_POR_ID,
  GENERO_POR_ID,
  MUNICIPIO_POR_ID,
  TIPO_DOCUMENTO_POR_ID,
} from '../crm/catalogos-sep';
import { PrismaService } from '../prisma/prisma.service';

/// Un dato, dicho por quien lo diga.
export type Dicho = {
  /// El valor tal como se guarda o se mandaría en un PATCH.
  valor: string | number | null;
  /// Cómo se lee. Un id del SEP no le dice nada a nadie.
  texto: string | null;
};

export type FilaComparada = {
  campo: string;
  etiqueta: string;
  /// Con qué clave se manda al `PATCH` de la ficha. Null: no se
  /// puede aplicar desde aquí (el documento es la identidad).
  clave: string | null;
  ficha: Dicho;
  /// Una entrada por lead, en el orden en que llegaron.
  leads: Array<Dicho & { deQuien: string }>;
  rui: Dicho | null;
  /// Si alguna fuente dice algo distinto de la ficha.
  discrepa: boolean;
  /// Si la ficha lo tiene vacío y alguna fuente lo trae.
  falta: boolean;
};

const CAMPOS: Array<{
  campo: string;
  etiqueta: string;
  clave: string | null;
}> = [
  { campo: 'primerNombre', etiqueta: 'Primer nombre', clave: 'primerNombre' },
  { campo: 'segundoNombre', etiqueta: 'Segundo nombre', clave: 'segundoNombre' },
  { campo: 'primerApellido', etiqueta: 'Primer apellido', clave: 'primerApellido' },
  { campo: 'segundoApellido', etiqueta: 'Segundo apellido', clave: 'segundoApellido' },
  { campo: 'correo', etiqueta: 'Correo', clave: 'correo' },
  { campo: 'celular', etiqueta: 'Celular', clave: 'celular' },
  { campo: 'generoSepId', etiqueta: 'Género', clave: 'generoSepId' },
  { campo: 'departamentoSepId', etiqueta: 'Departamento', clave: 'departamentoSepId' },
  { campo: 'municipioSepId', etiqueta: 'Ciudad', clave: 'municipioSepId' },
  /// El documento se enseña pero NO se aplica desde aquí.
  ///
  /// Es la identidad: cambiarlo no es corregir un dato, es decir
  /// que esta ficha es de otra persona. Eso tiene su propio
  /// camino y no puede ser un botón al lado de un correo.
  { campo: 'documento', etiqueta: 'Documento', clave: null },
];

@Injectable()
export class Comparativo {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Las tres fuentes de una ficha, campo por campo.
   *
   * Fuera del ámbito la ficha NO EXISTE: 404 y no 403, que es la
   * regla de todo el panel.
   */
  async de(participanteId: string, ambito: string[]) {
    const p = await this.prisma.participante.findFirst({
      where: { id: participanteId, convenioId: { in: ambito } },
      select: {
        id: true,
        convenioId: true,
        persona: {
          select: {
            id: true,
            primerNombre: true,
            segundoNombre: true,
            primerApellido: true,
            segundoApellido: true,
            correo: true,
            celular: true,
            generoSepId: true,
            departamentoSepId: true,
            municipioSepId: true,
            tipoDocumentoSepId: true,
            numeroDocumento: true,
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Esa ficha no existe.');

    /// Los leads de esta PERSONA, no solo los de esta ficha.
    ///
    /// La misma cédula puede haber pedido dos cursos y llegado
    /// por dos redes: son cuatro leads y cualquiera de ellos
    /// puede traer el dato que a la ficha le falta. Atarse al
    /// `participanteId` dejaría fuera justo los que no se
    /// convirtieron.
    const leads = await this.prisma.leadEntrante.findMany({
      where: {
        convenioId: p.convenioId,
        tipoDocumentoSepId: p.persona.tipoDocumentoSepId,
        numeroDocumento: p.persona.numeroDocumento,
      },
      orderBy: { recibidoEn: 'asc' },
      select: {
        id: true,
        origen: true,
        origenSistema: true,
        recibidoEn: true,
        primerNombre: true,
        segundoNombre: true,
        primerApellido: true,
        segundoApellido: true,
        correo: true,
        celular: true,
        generoSepId: true,
        departamentoSepId: true,
        municipioSepId: true,
        tipoDocumentoSepId: true,
        numeroDocumento: true,
      },
    });

    /// La última consulta al RUI que trajo algo.
    const rui = await this.prisma.consultaRui.findFirst({
      where: { personaId: p.persona.id, estado: 'LISTA' },
      orderBy: { creadoEn: 'desc' },
      select: { nombreEncontrado: true, simulado: true, creadoEn: true },
    });

    const filas = CAMPOS.map((c) => this.fila(c, p.persona, leads, rui));

    return {
      participanteId: p.id,
      /// De dónde viene cada columna, para poder rotularlas.
      fuentes: leads.map((l) => ({
        id: l.id,
        origen: l.origen,
        porDonde: l.origenSistema,
        recibidoEn: l.recibidoEn,
      })),
      rui: rui
        ? { simulado: rui.simulado, consultadoEn: rui.creadoEn }
        : null,
      filas,
      /// Cuántas piden atención, para poder decirlo sin contar.
      discrepan: filas.filter((f) => f.discrepa).length,
      faltan: filas.filter((f) => f.falta).length,
    };
  }

  private fila(
    c: { campo: string; etiqueta: string; clave: string | null },
    persona: Record<string, unknown>,
    leads: Array<Record<string, unknown>>,
    rui: { nombreEncontrado: string | null } | null,
  ): FilaComparada {
    const ficha = this.leer(c.campo, persona);

    const deLeads = leads.map((l) => ({
      ...this.leer(c.campo, l),
      deQuien: String(l.id),
    }));

    /// El RUI solo sabe del nombre.
    ///
    /// Devuelve el nombre completo, sin partir, así que se pone
    /// en la fila del primer nombre y ahí se compara entero: es
    /// como lo enseña hoy la ficha, y partirlo por nuestra cuenta
    /// cambiaría un dato cierto por uno adivinado.
    const delRui =
      c.campo === 'primerNombre' && rui?.nombreEncontrado
        ? { valor: rui.nombreEncontrado, texto: rui.nombreEncontrado }
        : null;

    const otros = [...deLeads, ...(delRui ? [delRui] : [])].filter(
      (d) => d.valor !== null && d.valor !== '',
    );

    const vacia = ficha.valor === null || ficha.valor === '';

    return {
      campo: c.campo,
      etiqueta: c.etiqueta,
      clave: c.clave,
      ficha,
      leads: deLeads,
      rui: delRui,
      /// Discrepa solo si la ficha TIENE algo y no coincide.
      ///
      /// Un hueco no es una contradicción: son dos cosas
      /// distintas y llevan a acciones distintas —rellenar o
      /// decidir—, así que se cuentan aparte.
      discrepa:
        !vacia &&
        otros.some(
          (d) => this.comparable(d.valor) !== this.comparable(ficha.valor),
        ),
      falta: vacia && otros.length > 0,
    };
  }

  /// Para comparar: sin mayúsculas, sin espacios de sobra.
  private comparable(v: string | number | null): string {
    return String(v ?? '')
      .trim()
      .toLowerCase();
  }

  private leer(campo: string, o: Record<string, unknown>): Dicho {
    if (campo === 'documento') {
      const tipo = o.tipoDocumentoSepId as number | null;
      const num = o.numeroDocumento as string | null;
      if (!num) return { valor: null, texto: null };
      const sigla = tipo ? (TIPO_DOCUMENTO_POR_ID.get(tipo)?.sigla ?? '') : '';
      return { valor: num, texto: `${sigla} ${num}`.trim() };
    }

    const v = (o[campo] ?? null) as string | number | null;
    if (v === null || v === '') return { valor: null, texto: null };

    /// Los ids del SEP se leen por su etiqueta: un «2» no le dice
    /// nada a quien está mirando la pantalla.
    if (campo === 'generoSepId') {
      return { valor: v, texto: GENERO_POR_ID.get(Number(v))?.etiqueta ?? String(v) };
    }
    if (campo === 'departamentoSepId') {
      return {
        valor: v,
        texto: DEPARTAMENTO_POR_ID.get(Number(v))?.etiqueta ?? String(v),
      };
    }
    if (campo === 'municipioSepId') {
      return { valor: v, texto: MUNICIPIO_POR_ID.get(Number(v))?.[2] ?? String(v) };
    }

    return { valor: v, texto: String(v) };
  }
}
