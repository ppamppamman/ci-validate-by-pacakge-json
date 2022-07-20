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
    // NOTE : https://docs.github.com/en/rest/git/refs#create-a-reference
    const attachLightweightTag = await octokit.request(
      `POST /repos/${OWNER}/${REPOSITORY}/git/refs`,
      {
        ...INITIAL_PARAMETER,
        ref: `refs/tags/${packageJson.version}`,
        sha: `${commit.data.sha}`,
      }
    );

    console.log("attachLightweightTag", attachLightweightTag);
  } catch (err) {
    // setFailed logs the message and sets a failing exit code
    core.setFailed(`Action failed with error ${err}`);
  }
};

execute();
