import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders and handles clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Create Event</Button>);

    const button = screen.getByRole("button", { name: "Create Event" });

    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("respects the disabled state", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        Publish
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Publish" });

    expect(button).toBeDisabled();

    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });
});
