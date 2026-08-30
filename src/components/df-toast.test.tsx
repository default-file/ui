import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { Toast, toast, Toaster } from "./df-toast"

afterEach(() => {
  toast.dismiss()
  cleanup()
})

describe("Toast contracts", () => {
  it("renders a status message, forwards className, and passes axe", async () => {
    const { container } = render(
      <Toast tone="success" message="Saved" className="toast-host" showClose={false} />
    )

    const status = screen.getByRole("status")
    expect(status).toHaveClass("toast-host")
    expect(status).toHaveTextContent("Saved")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("runs the dismiss control when provided", async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <Toast tone="info" message="Heads up" onDismiss={onDismiss} />
    )

    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("shows live toasts through the toaster host", async () => {
    render(<Toaster />)
    toast.success("Synced")
    expect(await screen.findByText("Synced")).toBeInTheDocument()
  })
})
