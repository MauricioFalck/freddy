import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";
import { APP_STATUS } from "@/lib/status";

describe("Home", () => {
  it("renders a single top-level heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: /the foundation is up/i }),
    ).toBeInTheDocument();
  });

  it("renders every status fact", () => {
    render(<Home />);
    for (const fact of APP_STATUS.facts) {
      expect(screen.getByText(fact.label)).toBeInTheDocument();
      expect(screen.getByText(fact.value)).toBeInTheDocument();
    }
  });
});
