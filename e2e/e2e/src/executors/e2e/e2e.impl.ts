import 'dotenv/config';

import type { ExecutorContext } from '@nrwl/devkit';
import {
  joinPathFragments,
  logger,
  parseTargetString,
  readNxJson,
  runExecutor,
} from '@nrwl/devkit';
import { tmpProjPath } from '@nrwl/nx-plugin/testing';
import type { NxPluginE2EExecutorOptions } from './schema';
import { ChildProcess } from 'child_process';
import {
  addUser,
  buildAllPackages,
  publishPackages,
  startVerdaccio,
} from '../../utils/registry';
import {
  cleanupVerdaccioStorage,
  killPort,
  updatePackageJsonFiles,
} from '../../utils';
import { ensureDirSync } from 'fs-extra';

// eslint-disable-next-line require-yield
export async function* nxPluginE2EExecutor(
  options: NxPluginE2EExecutorOptions,
  context: ExecutorContext
) {
  const verdaccioPort = options.verdaccioPort;
  const verdaccioUrl = `http://localhost:${verdaccioPort}/`;
  process.env.npm_config_registry = verdaccioUrl;
  process.env.YARN_REGISTRY = verdaccioUrl;

  // Ensure the temp directory where the projects will be generated is there
  ensureDirSync(tmpProjPath());

  let child: ChildProcess;
  try {
    child = await startVerdaccio(options.verdaccioConfig);
  } catch (e) {
    logger.info(`Verdaccio already running...`);
  }

  try {
    // sometimes you need a dummy use on different environments. Add and ignore catch case
    await addUser(verdaccioUrl);
  } catch (e) {
    //
  }

  try {
    const nxJson = readNxJson();
    const distDir = joinPathFragments('dist', nxJson.workspaceLayout.libsDir);
    buildAllPackages('e2e,docs,angular-vite,angular-nx,angular-swc');
    updatePackageJsonFiles('999.9.9', distDir, nxJson.npmScope);
    publishPackages(verdaccioUrl, distDir);

    const target = `${context.projectName}:${options.testTarget}`;
    const delegateTarget = parseTargetString(target);
    yield* await runExecutor(delegateTarget, {}, context);
  } catch (e) {
    logger.error(e.message);
  }

  cleanupVerdaccioStorage();

  try {
    child.kill();
  } catch (e) {
    await killPort(4872);
  }
}

export default nxPluginE2EExecutor;
