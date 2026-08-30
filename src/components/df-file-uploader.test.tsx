import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { FileUploader } from "./df-file-uploader"

afterEach(() => {
  cleanup()
})

describe("FileUploader contracts", () => {
  it("renders a named file input and forwards className", async () => {
    const onFile = vi.fn()
    const { container } = render(
      <FileUploader
        className="uploader-host"
        title="Upload logo"
        onFile={onFile}
      />
    )

    const root = container.querySelector('[data-df="file-uploader"]')
    expect(root).toHaveClass("uploader-host")
    expect(
      screen.getByLabelText("Upload logo", { selector: "input" })
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("disables the file input when disabled", () => {
    render(<FileUploader disabled title="Upload logo" onFile={() => {}} />)
    expect(screen.getByLabelText("Upload logo", { selector: "input" })).toBeDisabled()
  })
})
