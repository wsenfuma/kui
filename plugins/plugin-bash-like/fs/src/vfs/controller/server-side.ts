/*
 * Copyright 2020 IBM Corporation
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

import { Arguments, RawResponse, Registrar } from '@kui-shell/core'

import { ls, fstat } from '../delegates'
import { KuiGlobOptions, GlobStats } from '../../lib/glob'

export async function lsImpl(args: Arguments<KuiGlobOptions>): Promise<RawResponse<GlobStats[]>> {
  return {
    mode: 'raw',
    content: await ls(args, args.argvNoOptions.slice(2))
  }
}

export async function fstatImpl(args: Arguments) {
  return {
    mode: 'raw',
    content: await fstat(
      args,
      args.argvNoOptions[2],
      !!args.parsedOptions['with-data'],
      !!args.parsedOptions['enoent-ok']
    )
  }
}

export default function(registrar: Registrar) {
  registrar.listen('/vfs/_ls', lsImpl, {
    requiresLocal: true,
    flags: {
      boolean: ['A', 'a', 'd', 'c', 'C', 'l', 'h', 't', 'r', 's', 'S']
    }
  })

  registrar.listen('/vfs/_fstat', fstatImpl, {
    requiresLocal: true,
    flags: {
      boolean: ['with-data', 'enoent-ok']
    }
  })
}
