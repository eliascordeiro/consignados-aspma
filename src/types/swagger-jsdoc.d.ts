declare module 'swagger-jsdoc' {
  interface Options {
    definition?: {
      openapi?: string;
      info?: {
        title?: string;
        version?: string;
        description?: string;
        [key: string]: any;
      };
      servers?: Array<{ url: string; description?: string }>;
      components?: Record<string, any>;
      [key: string]: any;
    };
    apis?: string[];
    [key: string]: any;
  }

  function swaggerJsdoc(options: Options): Record<string, any>;

  namespace swaggerJsdoc {
    export type { Options };
  }

  export = swaggerJsdoc;
}
