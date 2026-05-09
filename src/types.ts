export interface GitSource {
  type: 'git'
  name: string
  location: string
  path?: string
}

export interface LocalSource {
  type: 'local'
  name: string
  location: string
}

export type Source = GitSource | LocalSource

export interface Destination {
  name: string
  location: string
}

export interface CopyRecord {
  source: string
  destination: string
  file: string
  copiedAt?: string
}

export interface ScopyConfig {
  sources: Source[]
  destinations: Destination[]
  repo_pull_ttl_sec: number
  lastPullTimestamps: Record<string, string>
}

export interface CopiesConfig {
  copies: CopyRecord[]
}

export interface PackageJson {
  name: string
  description: string
  version: string
}

export function isPackageJson(v: unknown): v is PackageJson {
  return (
    typeof v === 'object' && v !== null &&
    'name' in v && typeof (v as Record<string, unknown>).name === 'string' &&
    'description' in v && typeof (v as Record<string, unknown>).description === 'string' &&
    'version' in v && typeof (v as Record<string, unknown>).version === 'string'
  )
}
