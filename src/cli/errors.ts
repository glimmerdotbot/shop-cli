export class CliError extends Error {
  exitCode: number
  silent: boolean

  constructor(message: string, exitCode = 1, { silent = false }: { silent?: boolean } = {}) {
    super(message)
    this.exitCode = exitCode
    this.silent = silent
  }
}
