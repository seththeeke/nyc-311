/* swagger-ui-dist ships no types; only the slice the Reference uses. */
declare module "swagger-ui-dist/swagger-ui-es-bundle.js" {
  interface SwaggerUiRequest {
    headers: Record<string, string>;
  }
  interface SwaggerUiOptions {
    domNode: HTMLElement;
    deepLinking?: boolean;
    tryItOutEnabled?: boolean;
    requestInterceptor?: (request: SwaggerUiRequest) => SwaggerUiRequest;
  }
  interface SwaggerUiInstance {
    specActions: { updateSpec(spec: string): void };
  }
  const SwaggerUI: (options: SwaggerUiOptions) => SwaggerUiInstance;
  export default SwaggerUI;
}
