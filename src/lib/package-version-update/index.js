const core = require("@actions/core");
const github = require("@actions/github");
const dotenv = require("dotenv");

const BASE_DIRECTORY = process.cwd();
const packageJson = require(`${BASE_DIRECTORY}/package.json`);

const execute = async () => {
  try {
    dotenv.config();

    const token = core.getInput("github-token");
    // const token = process.env.GITHUB_TOKEN;
    const octokit = github.getOctokit(token);
    const prevAppVersion = packageJson.version;
    const currentAppVersionSplit = packageJson.version
      .split(/(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/)
      .filter(v => v !== "");

    // NOTE : https://docs.github.com/en/rest/users/users
    const user = await octokit.request("GET /users/ppamppamman", {});

    // NOTE : constants
    const OWNER = user.data.login;
    const REPOSITORY = "ci-validate-by-pacakge-json";
    const TARGET_BRANCH = "main";
    const REFERENCE_HEADS_OF_TARGET_BRANCH = `heads/${TARGET_BRANCH}`;
    const INITIAL_PARAMETER = {
      owner: OWNER,
      repo: REPOSITORY,
    };

    // NOTE : https://docs.github.com/en/rest/git/refs#get-a-reference
    const targetBranchHeadRef = await octokit.request(
      `GET /repos/${OWNER}/${REPOSITORY}/git/ref/${REFERENCE_HEADS_OF_TARGET_BRANCH}`,
      {
        ...INITIAL_PARAMETER,
        ref: `refs/head/${TARGET_BRANCH}`,
      }
    );

    // NOTE : https://docs.github.com/en/rest/git/commits
    const commit = await octokit.request(
      `GET /repos/${OWNER}/${REPOSITORY}/git/commits/${targetBranchHeadRef.data.object.sha}`,
      {
        ...INITIAL_PARAMETER,
        commit_sha: targetBranchHeadRef.data.object.sha,
      }
    );

    // console.log("commit", commit); ok

    const latestTrees = await octokit.request(
      `GET /repos/${OWNER}/${REPOSITORY}/git/trees/${commit.data.tree.sha}`,
      {
        ...INITIAL_PARAMETER,
        tree_sha: commit.data.tree.sha,
      }
    );
    // console.log("latestTrees", latestTrees); ok

    const TARGET_FILE = latestTrees.data.tree.find(
      eachTree => eachTree.path === "package.json"
    );
    console.log("TARGET_FILE", TARGET_FILE);

    const updatedAppPatchVersion = currentAppVersionSplit
      .map((v, i) => (i === 2 ? Number(v) + 1 : Number(v)))
      .join(".");
    packageJson.version = updatedAppPatchVersion;

    const TREE_MODE_VALUE_BLOB = "100644";
    const createdBlob = await octokit.request(
      `POST /repos/${OWNER}/${REPOSITORY}/git/blobs`,
      {
        ...INITIAL_PARAMETER,
        content: JSON.stringify(packageJson, null, 2),
      }
    );
    const createTree = await octokit.request(
      `POST /repos/${OWNER}/${REPOSITORY}/git/trees`,
      {
        ...INITIAL_PARAMETER,
        base_tree: commit.data.tree.sha,
        tree: [
          {
            path: "package.json",
            mode: TREE_MODE_VALUE_BLOB,
            type: "blob",
            sha: createdBlob.data.sha,
          },
        ],
      }
    );
    //  console.log("createTree", createTree); ok

    // NOTE : https://docs.github.com/en/rest/git/commits#create-a-commit
    const createdCommit = await octokit.request(
      `POST /repos/${OWNER}/${REPOSITORY}/git/commits`,
      {
        ...INITIAL_PARAMETER,
        message: `fix: update version from ${prevAppVersion} to ${updatedAppPatchVersion}`,
        author: {
          name: "update-bot",
          email: "update-bot@lemonbase.com",
        },
        parents: [commit.data.sha],
        tree: createTree.data.sha,
      }
    );
    // console.log("createdCommit", createdCommit) ok;

    const updateRef = await octokit.request(
      `PATCH /repos/${OWNER}/${REPOSITORY}/git/refs/${REFERENCE_HEADS_OF_TARGET_BRANCH}`,
      {
        ...INITIAL_PARAMETER,
        ref: `refs/head/${TARGET_BRANCH}`,
        sha: createdCommit.data.sha,
        force: true,
      }
    );
    console.log("updateRef", updateRef);
  } catch (err) {
    // setFailed logs the message and sets a failing exit code
    console.log(err);
    core.setFailed(`Action failed with error ${err}`);
  }
};

execute();
