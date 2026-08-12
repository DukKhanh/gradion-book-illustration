export interface IllustrationReader {
  illustrationExists(path: string): Promise<boolean>
  readIllustration(path: string): Promise<Buffer>
}
