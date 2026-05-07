export interface PageConfig {
  pageId: string;
  title: string;
}

export interface Field {
  campo: string | null;
  definicao: string | null;
  regraDePreenchimento: string | null;
  roles: string | null;
  httpCode: string | null;
  metodos: string[];
  dominio: string[];
  endpoints: string[];
  versoes: string[];
  tamanhoMaximo: string | null;
  padrao: string | null;
  exemplo: string | null;
  [key: string]: string | string[] | null;
}

export interface PageResult {
  pageId: string;
  title: string;
  url: string;
  fields: Field[];
}

export interface OutputData {
  extractedAt: string;
  version: string;
  pages: PageResult[];
}

