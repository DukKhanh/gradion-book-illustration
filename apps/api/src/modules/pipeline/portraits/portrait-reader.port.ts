export interface PortraitReader {
  portraitExists(path: string): Promise<boolean>
  readPortrait(path: string): Promise<Buffer>
}
