/*
 * Copyright 2019 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Arguments } from '@kui-shell/core'
import { doExecWithStdout, KubeOptions, commandPrefix } from '@kui-shell/plugin-kubectl'

export default function doExec<O extends KubeOptions>(args: Arguments<O>) {
  const cmd = args.argv[0] === commandPrefix ? args.argv[1] : args.argv[0]
  return doExecWithStdout(args, undefined, cmd)
}
