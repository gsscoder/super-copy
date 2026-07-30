export async function resolveBranchSha(owner: string, repo: string, branch: string): Promise<string> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`;
  const res = await fetch(apiUrl, {
    headers: { Accept: 'application/vnd.github.sha', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error(`branch "${branch}" not found in ${owner}/${repo}`);
    throw new Error(`GitHub API error ${res.status} for ${apiUrl}`);
  }
  return (await res.text()).trim();
}
