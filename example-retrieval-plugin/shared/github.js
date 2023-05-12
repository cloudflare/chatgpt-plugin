/**
 * @param {string} apiKey
 * @param {string} owner
 * @param {string} name
 * @param {string[]} dirs
 */
export async function fetchMdFiles(apiKey, owner, name, dirs) {
  const maxDepth = 5;
  const dirQueries = dirs
    .map((dir, ix) => {
      let treeExpr = "...on Tree{entries{name oid}}";
      for (let i = 0; i < maxDepth; i++) {
        treeExpr = `...on Tree{entries{name oid object{${treeExpr}}}}`;
      }
      return `obj_${ix}:object(expression:"HEAD:${dir}"){${treeExpr}}`;
    })
    .join("");
  const query = `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){${dirQueries}}}`;

  const {
    data: { repository },
  } = await fetchGithub(apiKey, {
    query,
    variables: { owner, name },
  });

  return dirs
    .map((dir, ix) => recurseMdEntries(dir, repository[`obj_${ix}`].entries))
    .flat();
}

/**
 * @param {string} dir
 * @param {TreeEntry[]} entries
 * @return {{path: string, oid: string}[]}
 */
function recurseMdEntries(dir, entries) {
  return entries
    .filter(
      ({ name, object: { entries } }) => entries != null || name.endsWith(".md")
    )
    .map(({ name, oid, object: { entries } }) =>
      entries != null
        ? recurseMdEntries(`${dir}/${name}`, entries)
        : { path: `${dir}/${name}`, oid }
    )
    .flat();
}

/**
 * @param {string} apiKey
 * @param {string} owner
 * @param {string} name
 * @param {{path: string, oid: string}[]} files
 */
export async function fetchFileContents(apiKey, owner, name, files) {
  const fileQueries = files
    .map(
      ({ oid }, ix) =>
        `obj_${ix}:object(oid:${JSON.stringify(oid)}){...on Blob{text}}`
    )
    .join("");
  const query = `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){${fileQueries}}}`;

  const {
    data: { repository },
  } = await fetchGithub(apiKey, {
    query,
    variables: { owner, name },
  });

  return files.map((file, ix) => ({
    text: repository[`obj_${ix}`].text,
    ...file,
  }));
}

const GITHUB_GRAPHQL_API_BASE = "https://api.github.com/graphql";

/**
 * @param {string} apiKey
 * @param {{operationName?: string, query: string, variables?: any}} graphqlPayload
 */
async function fetchGithub(apiKey, graphqlPayload) {
  const NUM_RETRIES = 100;
  const INIT_RETRY_MS = 50;
  for (let i = 0; i <= NUM_RETRIES; i++) {
    const res = await fetch(GITHUB_GRAPHQL_API_BASE, {
      method: "POST",
      headers: {
        "User-Agent": "graphql-fetcher",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "gzip",
      },
      body: JSON.stringify(graphqlPayload),
    });
    if ((res.status < 500 && res.status !== 429) || i === NUM_RETRIES) {
      return res.json();
    }
    // Exponential backoff with full jitter
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * INIT_RETRY_MS * Math.pow(2, i))
    );
  }
  // Should never reach here – last loop iteration should return
  throw new Error("An unknown error occurred");
}
