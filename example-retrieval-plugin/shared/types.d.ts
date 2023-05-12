interface Chunk {
  id: string;
  filePath: string;
  fileId: string;
  title: string;
  text: string;
}

interface TreeEntry {
  name: string;
  oid: string;
  object: { entries?: TreeEntry[] };
}

type Vector =
  | number[]
  | Float32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array;
