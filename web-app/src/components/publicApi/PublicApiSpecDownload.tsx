import { useEffect, useMemo, type ReactElement } from "react";
import { usePublicApiSpec } from "../../hooks/usePublicApiSpec";

export const SPEC_FILE_NAME = "boroughsim-public-api.yaml";

/**
 * The hosted OpenAPI spec as a download (16-resident-action-models.md
 * §6.2). The spec route needs `X-Requester` like every /v1/ route, so the
 * page fetches it and offers the file rather than linking to the URL.
 */
export function PublicApiSpecDownload(): ReactElement {
  const { data: spec, isError, error } = usePublicApiSpec();
  const href = useMemo(() => (spec ? URL.createObjectURL(new Blob([spec], { type: "application/yaml" })) : null), [spec]);
  useEffect(() => () => {
    if (href) URL.revokeObjectURL(href);
  }, [href]);

  return (
    <section aria-labelledby="public-api-spec" className="mt-10 rounded-xl border border-line bg-panel p-6 text-center">
      <h2 id="public-api-spec" className="text-xl font-bold text-fg">
        Build against the spec
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-fg-subtle">
        The full OpenAPI 3.1 model, served by the API itself at <code className="font-mono">/v1/openapi.yaml</code>. Import it
        into Swagger, Postman or your code generator.
      </p>
      {isError ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          Failed to load the API spec: {error.message}
        </p>
      ) : href ? (
        <a
          href={href}
          download={SPEC_FILE_NAME}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-hue-cyan to-hue-emerald px-5 py-2.5 text-sm font-semibold text-on-accent shadow hover:opacity-90"
        >
          Download Swagger model
        </a>
      ) : (
        <p className="mt-4 text-sm text-fg-subtle">Loading…</p>
      )}
    </section>
  );
}
