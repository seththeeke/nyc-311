import { useEffect, useRef, useState, type ReactElement } from "react";
import { usePublicApiSpec } from "../../hooks/usePublicApiSpec";
import { DOCS_REQUESTER } from "../../services/publicApiSpecService";

type SwaggerUiFactory = typeof import("swagger-ui-dist/swagger-ui-es-bundle.js").default;

/* Swagger UI is large, so it and its stylesheet load only when this section renders. */
export function loadSwaggerUi(): Promise<SwaggerUiFactory> {
  return Promise.all([import("swagger-ui-dist/swagger-ui-es-bundle.js"), import("swagger-ui-dist/swagger-ui.css")]).then(
    ([module]) => module.default
  );
}

const SWAGGER_BACKGROUND = "#ffffff";

export interface PublicApiReferenceProps {
  /** Loads Swagger UI; replaceable so a test can hold the load open. */
  loadSwagger?: () => Promise<SwaggerUiFactory>;
}

/** The OpenAPI reference with "Try it" (16-resident-action-models.md §6.2); calls carry this page's X-Requester. */
export function PublicApiReference({ loadSwagger = loadSwaggerUi }: PublicApiReferenceProps): ReactElement {
  const { data: spec, isPending, isError, error } = usePublicApiSpec();
  const container = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const domNode = container.current;
    if (!spec || !domNode) return;
    let cancelled = false;
    loadSwagger()
      .then((SwaggerUI) => {
        if (cancelled) return;
        const ui = SwaggerUI({
          domNode,
          deepLinking: false,
          tryItOutEnabled: true,
          requestInterceptor: (request) => {
            request.headers["X-Requester"] ??= DOCS_REQUESTER;
            return request;
          },
        });
        ui.specActions.updateSpec(spec);
      })
      .catch((err: unknown) => {
        if (!cancelled) setRenderError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [spec, loadSwagger]);

  return (
    <section aria-labelledby="public-api-reference" className="mt-10">
      <h2 id="public-api-reference" className="text-xl font-bold text-fg">
        Reference
      </h2>
      <p className="mt-1 text-sm text-fg-subtle">
        The OpenAPI spec, served by the API itself at <code className="font-mono">/v1/openapi.yaml</code>.
      </p>
      {isPending && <p className="mt-4 text-fg-subtle">Loading…</p>}
      {isError && (
        <p role="alert" className="mt-4 text-danger">
          Failed to load the API spec: {error.message}
        </p>
      )}
      {renderError && (
        <p role="alert" className="mt-4 text-danger">
          Failed to render the API reference: {renderError}
        </p>
      )}
      {/* Swagger UI draws fixed dark-on-light text, so its panel stays light in every theme. */}
      <div ref={container} data-testid="swagger-ui" className="mt-4 rounded-lg p-2" style={{ backgroundColor: SWAGGER_BACKGROUND }} />
    </section>
  );
}
