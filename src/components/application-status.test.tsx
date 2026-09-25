import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApplicationStatus } from "./application-status";

afterEach(cleanup);

describe("ApplicationStatus", () => {
  it("apresenta o nome e o estado inicial da aplicacao", () => {
    render(<ApplicationStatus />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Uma Frase" }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "Aplicacao Next.js pronta para o desenvolvimento do MVP 0.1.",
      ),
    ).toBeDefined();
  });
});
