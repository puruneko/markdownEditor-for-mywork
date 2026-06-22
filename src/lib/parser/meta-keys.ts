export const META_KEYS = {
  schedule:  'schedule',
  due:       'due',
  priority:  'priority',
  dependsOn: 'dependsOn',
  tags:      'tags',
} as const

export type MetaKey = keyof typeof META_KEYS
