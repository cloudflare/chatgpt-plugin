const ID_BYTES = 8; // 64 bits
const HEADER_BYTE_LENGTH = 2 * Uint16Array.BYTES_PER_ELEMENT;

// OpenAI embeddings are [-1, 1), so we can
// quantize to Int16 by multiplying by 2^15
const QUANTIZE_MAX = Math.pow(2, 15);

export class VectorCollection {
  static VERSION = 1;

  /**
   * @param {ArrayBuffer | number | null} [buffer]
   * @param {Uint16Array | number} [header]
   * @param {Uint8Array} [ids]
   * @param {Int16Array} [embeddings]
   */
  constructor(buffer, header, ids, embeddings) {
    if (typeof buffer === "number" || typeof header === "number") {
      const length = Number(buffer);
      const embeddingLength = Number(header);
      buffer = new ArrayBuffer(
        HEADER_BYTE_LENGTH +
          length * (ID_BYTES + embeddingLength * Int16Array.BYTES_PER_ELEMENT)
      );
      header = new Uint16Array(buffer, 0, 2);
      header[0] = VectorCollection.VERSION;
      header[1] = length;
    }
    this.buffer =
      buffer && buffer.byteLength >= HEADER_BYTE_LENGTH
        ? buffer
        : new Uint16Array([VectorCollection.VERSION, 0]).buffer;
    this.header = header ?? new Uint16Array(this.buffer, 0, 2);
    if (this.header[0] > VectorCollection.VERSION) {
      throw new Error("Unsupported version: " + this.header[0]);
    }
    this.length = this.header[1];
    this.ids =
      ids ??
      new Uint8Array(this.buffer, HEADER_BYTE_LENGTH, this.length * ID_BYTES);
    this.embeddings =
      embeddings ??
      new Int16Array(this.buffer, HEADER_BYTE_LENGTH + this.length * ID_BYTES);
    this.embeddingLength = this.embeddings.length / this.length;
  }

  /**
   * NB: This assumes `embedding` is an array of floats in the range [-1, 1)
   *
   * @param {{id: string, embedding: number[]}[]} embeddingsWithIds
   * @returns {VectorCollection}
   */
  static from(embeddingsWithIds) {
    const numEmbeddings = embeddingsWithIds.length;
    const embeddingLength = embeddingsWithIds[0]?.embedding.length ?? 0;

    const collection = new VectorCollection(numEmbeddings, embeddingLength);

    for (let i = 0; i < embeddingsWithIds.length; i++) {
      const { id, embedding } = embeddingsWithIds[i];
      const idBytes = (id.match(/../g) ?? []).map((b) => parseInt(b, 16));
      const quantizedEmbedding = embedding.map((x) =>
        Math.min(Math.round(x * QUANTIZE_MAX), QUANTIZE_MAX - 1)
      );
      collection.ids.set(idBytes, i * ID_BYTES);
      collection.embeddings.set(quantizedEmbedding, i * embeddingLength);
    }

    return collection;
  }

  /**
   * @param {VectorCollection[]} newCollections
   * @param {VectorCollection} existingCollection
   * @param {Set<string>} deletedIds
   * @returns {VectorCollection}
   */
  static merge(newCollections, existingCollection, deletedIds) {
    let totalEmbeddings = 0;
    let embeddingLength = 0;
    let idArrays = [];
    let embeddingArrays = [];

    for (const collection of newCollections) {
      totalEmbeddings += collection.length;
      embeddingLength ||= collection.embeddingLength;
      idArrays.push(collection.ids);
      embeddingArrays.push(collection.embeddings);
    }

    const existingIds = [...existingCollection.idStrs()];

    for (let ix = 0; ix < existingIds.length; ix++) {
      if (deletedIds.has(existingIds[ix])) {
        continue;
      }
      totalEmbeddings++;
      embeddingLength ||= existingCollection.embeddingLength;
      idArrays.push(existingCollection.idAt(ix));
      embeddingArrays.push(existingCollection.vectorAt(ix));
    }

    const collection = new VectorCollection(totalEmbeddings, embeddingLength);

    let offset = 0;
    for (const idArray of idArrays) {
      collection.ids.set(idArray, offset);
      offset += idArray.length;
    }
    offset = 0;
    for (const embeddingArray of embeddingArrays) {
      collection.embeddings.set(embeddingArray, offset);
      offset += embeddingArray.length;
    }

    return collection;
  }

  /** @param {number} ix */
  idAt(ix) {
    return new Uint8Array(
      this.ids.buffer,
      this.ids.byteOffset + ix * ID_BYTES * this.ids.BYTES_PER_ELEMENT,
      ID_BYTES
    );
  }

  /** @param {number} ix */
  idStrAt(ix) {
    return [...this.idAt(ix)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /** @param {number} ix */
  vectorAt(ix) {
    return new Int16Array(
      this.embeddings.buffer,
      this.embeddings.byteOffset +
        ix * this.embeddingLength * this.embeddings.BYTES_PER_ELEMENT,
      this.embeddingLength
    );
  }

  *idStrs() {
    for (let ix = 0; ix < this.length; ix++) {
      yield this.idStrAt(ix);
    }
  }

  /**
   * NB: This assumes `query` is an array of floats in the range [-1, 1)
   *
   * @param {number[]} query
   * @param {number} numK
   */
  topK(query, numK) {
    const { embeddings, embeddingLength } = this;
    query = query.map((x) => x * QUANTIZE_MAX);

    // Minor optimization, we use euclidian distance to compare,
    // and then only calculate cosine similarity on the top K.
    // For millions of vectors, a max-heap would work better here,
    // rather that allocating and sorting the entire array.
    return Array.from({ length: this.length }, (_, ix) => ({
      ix,
      distance: sqeuclidian(query, embeddings, ix * embeddingLength),
    }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, numK)
      .map(({ ix }) => ({
        id: this.idStrAt(ix),
        similarity: cosine(query, embeddings, ix * embeddingLength),
      }));
  }
}

/**
 * @param {Vector} v1
 * @param {Vector} v2
 * @param {number} [v2StartIx]
 */
function sqeuclidian(v1, v2, v2StartIx = 0) {
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    const diff = v1[i] - v2[v2StartIx + i];
    sum += diff * diff;
  }
  return sum;
}

/**
 * @param {Vector} v1
 * @param {Vector} v2
 * @param {number} [v2StartIx]
 */
function cosine(v1, v2, v2StartIx = 0) {
  let dotproduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < v1.length; i++) {
    const j = i + v2StartIx;
    dotproduct += v1[i] * v2[j];
    mA += v1[i] * v1[i];
    mB += v2[j] * v2[j];
  }
  return dotproduct / (Math.sqrt(mA) * Math.sqrt(mB));
}
