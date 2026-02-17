import { CliError } from './errors'
import { printJson } from './output'

export const maybeFailOnUserErrors = ({
  payload,
  failOnUserErrors,
}: {
  payload: any
  failOnUserErrors: boolean
}) => {
  const userErrors = payload?.userErrors
  if (!Array.isArray(userErrors) || userErrors.length === 0) return

  printJson({ userErrors })

  if (failOnUserErrors) {
    throw new CliError('Shopify returned userErrors', 2)
  }
}

