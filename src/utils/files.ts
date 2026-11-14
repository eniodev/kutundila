import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

export async function readFileBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

/** Resolves a bundled asset (require(...)) to a local file and reads its bytes. */
export async function readAssetBytes(module: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Não foi possível carregar o modelo de teste.');
  return readFileBytes(asset.localUri);
}

/** Lets React paint (e.g. a spinner) before a blocking parse starts. */
export const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
