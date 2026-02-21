import JSON5 from 'json5'

export const parseJson5 = (value: string): any => JSON5.parse(value)
