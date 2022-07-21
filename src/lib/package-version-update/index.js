const core = require("@actions/core");
const github = require("@actions/github");
const dotenv = require("dotenv");

const BASE_DIRECTORY = process.cwd();
const packageJson = require(`${BASE_DIRECTORY}/package.json`);
const PREV_APP_VERSION = packageJson.version;

const TREE_MODE_VALUE_BLOB = "100644";
const REPOSITORY = "ci-validate-by-pacakge-json";
const TARGET_BRANCH = "main";
const REFERENCE_HEADS_OF_TARGET_BRANCH = `heads/${TARGET_BRANCH}`;

const execute = async () => {
  try {
    dotenv.config();

    const token = core.getInput("github-token");
    const octokit = github.getOctokit(token);

    // NOTE : https://docs.github.com/en/rest/users/users
    const user = await octokit.request("GET /users/ppamppamman", {});
    const OWNER = user.data.login;
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

    const currentAppVersionSplit = packageJson.version
      .split(/(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/)
      .filter(v => v !== "");
    const updatedAppPatchVersion = currentAppVersionSplit
      .map((v, i) => (i === 2 ? Number(v) + 1 : Number(v)))
      .join(".");
    packageJson.version = updatedAppPatchVersion;

    const createdPackageJsonBlob = await octokit.request(
      `POST /repos/${OWNER}/${REPOSITORY}/git/blobs`,
      {
        ...INITIAL_PARAMETER,
        content: JSON.stringify(packageJson, null, 2),
      }
    );
    const createdVersionJsonBlob = await octokit.request(
      `POST /repos/${OWNER}/${REPOSITORY}/git/blobs`,
      {
        ...INITIAL_PARAMETER,
        content: JSON.stringify({ version: updatedAppPatchVersion }, null, 2),
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
            sha: createdPackageJsonBlob.data.sha,
          },
          {
            path: "public/version.json",
            mode: TREE_MODE_VALUE_BLOB,
            type: "blob",
            sha: createdVersionJsonBlob.data.sha,
          },
        ],
      }
    );

    // NOTE : https://docs.github.com/en/rest/git/commits#create-a-commit
    const createdCommit = await octokit.request(
      `POST /repos/${OWNER}/${REPOSITORY}/git/commits`,
      {
        ...INITIAL_PARAMETER,
        message: `fix: update version from ${PREV_APP_VERSION} to ${updatedAppPatchVersion}`,
        author: {
          name: "update-bot",
          email: "update-bot@lemonbase.com",
        },
        parents: [commit.data.sha],
        tree: createTree.data.sha,
      }
    );

    const updateRef = await octokit.request(
      `PATCH /repos/${OWNER}/${REPOSITORY}/git/refs/${REFERENCE_HEADS_OF_TARGET_BRANCH}`,
      {
        ...INITIAL_PARAMETER,
        ref: `refs/head/${TARGET_BRANCH}`,
        sha: createdCommit.data.sha,
        force: true,
      }
    );
    console.log("updateRef result", updateRef);
  } catch (err) {
    console.log(err);

    // setFailed logs the message and sets a failing exit code
    core.setFailed(`Action failed with error ${err}`);
  }
};

execute();
