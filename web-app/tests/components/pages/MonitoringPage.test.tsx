import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MonitoringPage } from "../../../src/components/pages/MonitoringPage";

describe("MonitoringPage", () => {
  it("renders a 311 Request Metrics tile linking to /monitoring/ingestion", () => {
    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Monitoring" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /311 Request Metrics/ })).toHaveAttribute(
      "href",
      "/monitoring/ingestion"
    );
  });

  it("renders a Pipeline tile linking to /monitoring/pipeline", () => {
    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /pipeline/i })).toHaveAttribute(
      "href",
      "/monitoring/pipeline"
    );
  });

  it("renders a Lambda Health tile linking to /monitoring/lambda-health", () => {
    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /lambda health/i })).toHaveAttribute(
      "href",
      "/monitoring/lambda-health"
    );
  });

  it("renders a Test Coverage tile linking out to the hosted coverage report in a new tab", () => {
    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /test coverage/i });
    expect(link).toHaveAttribute("href", "/coverage/index.html");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders an Integration Tests tile linking to /monitoring/integration-tests", () => {
    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /integration tests/i });
    expect(link).toHaveAttribute("href", "/monitoring/integration-tests");
    expect(link).not.toHaveAttribute("target");
  });

  it("renders a Data Modeling tile linking to /data (moved here from the home page)", () => {
    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /data modeling/i });
    expect(link).toHaveAttribute("href", "/data");
    expect(link).not.toHaveAttribute("target");
  });

});
