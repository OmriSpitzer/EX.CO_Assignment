import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../client/src/App";

describe("App", () => {
  it("renders the message, version, and pod name", () => {
    render(
      <App
        boot={{
          message: "Hello from EX.CO",
          version: "1.2.3",
          podName: "pod-a",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Hello from EX.CO" })).toBeTruthy();
    expect(screen.getByText("Version: 1.2.3")).toBeTruthy();
    expect(screen.getByText("Pod: pod-a")).toBeTruthy();
  });
});
