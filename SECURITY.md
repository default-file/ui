# Security Policy

## Supported versions

Security fixes land on the latest published minor release of
`@default-file/ui`. Older versions are not patched.

## Reporting a vulnerability

Do not open a public issue for a security problem.

Report it through GitHub private vulnerability reporting on the
[Security tab](https://github.com/default-file/ui/security/advisories/new),
or send the details to security@defaultfile.com.

Please include:

- A description of the issue and the impact you expect.
- The kit version and the environment where you saw it.
- Steps to reproduce, or a small sample project.

## What to expect

- Acknowledgement within 3 working days.
- An assessment and a planned fix window within 10 working days.
- Credit in the release notes when a report leads to a fix, unless you ask us
  not to.

## Scope

This kit ships React components, CSS, a CLI, and an MCP server. Reports that
are in scope include supply chain issues in the published package, unsafe file
writes from `df-ui init` or `df-ui add`, and code paths in the MCP server that
read or write outside the target project.

Rendering untrusted HTML that a consuming application passes into a component
is out of scope. Sanitize input in the application.
