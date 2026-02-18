export type FlagSpec = {
  label: string
  description?: string
  required?: boolean
}

export type OperationSpec = {
  type: 'mutation' | 'query'
  name: string
  inputArg?: string
}

export type InputSpec = {
  mode: 'set' | 'none'
  arg?: string
  required?: boolean
}

export type VerbOutputSpec = {
  view?: boolean
  selection?: boolean
  pagination?: boolean
}

export type VerbSpec = {
  verb: string
  description?: string
  operation?: OperationSpec
  input?: InputSpec
  requiredFlags?: FlagSpec[]
  flags?: FlagSpec[]
  output?: VerbOutputSpec
  examples?: string[]
  notes?: string[]
}

export type ResourceSpec = {
  resource: string
  description?: string
  verbs: VerbSpec[]
}
