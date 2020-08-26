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

import TrieSearch from 'trie-search'
import { basename, dirname, join } from 'path'
import { Arguments, CodedError, flatten } from '@kui-shell/core'
import { FStat, VFS, mount } from '@kui-shell/plugin-bash-like/fs'
import { productName } from '@kui-shell/client/config.d/name.json'

interface Tutorial {
  name: string
  tutorial: Record<string, any> // FIXME type for snapshot

  path: string
  nameForDisplay: string
}

interface Entry {
  mountPath: string
}

type Directory = Entry

interface Leaf extends Entry {
  data: Record<string, any> // FIXME snapshot type
}

function isDirectory(entry: Entry): entry is Directory {
  return (entry as Leaf).data === undefined
}

const uid = 0
const gid = 0
const username = productName

class TutorialVFS implements VFS {
  public readonly mountPath = '/kui'
  public readonly isLocal = false

  protected readonly prefix = new RegExp(`^${this.mountPath}\\/?`)

  private readonly trie: TrieSearch<Directory | Leaf> = new TrieSearch()

  /** Turn an ls-style glob into a nodejs-style regexp */
  private glob2RegExp(filepath: string): string {
    return filepath.replace(/\//g, '\\/').replace(/\*/g, '.*')
  }

  private dirPattern(filepath: string): RegExp {
    // /kui/kubernetes -> /\/kui\/kubernetes/[^/]*$/
    if (filepath.charAt(filepath.length - 1) === '/') {
      return new RegExp(`^${this.glob2RegExp(filepath)}[^/]+$`)
    } else {
      return this.dirPattern(filepath + '/')
    }
  }

  private filePattern(filepath: string): RegExp {
    // /kui/kubernetes/j* -> /\/kui\/kubernetes/j*\.json$/
    return new RegExp(`^${this.glob2RegExp(filepath)}` + (/\.json$/.test(filepath) ? '' : '.json$'))
  }

  private find(filepath: string): Entry[] {
    const dirPattern = this.dirPattern(filepath)
    const filePattern = this.filePattern(filepath)

    return this.trie
      .get(filepath.replace(/\*$/, ''))
      .filter(_ => filePattern.test(_.mountPath) || dirPattern.test(_.mountPath))
  }

  private enumerate({ entries }: { entries: Entry[] }) {
    return entries.map(mount => {
      const name = basename(mount.mountPath)
      const isFile = !isDirectory(mount)

      return {
        name,
        nameForDisplay: name,
        path: mount.mountPath,
        stats: {
          size: 0,
          mtimeMs: 0,
          mode: 0,
          uid,
          gid
        },
        dirent: {
          isFile,
          isDirectory: !isFile,
          isSymbolicLink: false,
          isSpecial: false,
          isExecutable: false,
          permissions: '',
          username
        }
      }
    })
  }

  public async ls(_, filepaths: string[]) {
    return flatten(
      filepaths
        .map(filepath => ({ filepath, entries: this.find(filepath) }))
        .filter(_ => _.entries.length > 0)
        .map(_ => this.enumerate(_))
    )
  }

  /** Insert filepath into directory */
  public async cp(_, srcFilepath: string, dstFilepath: string): Promise<string> {
    const match1 = srcFilepath.match(/^plugin:\/\/plugin-(.*)\/tutorials\/(.*)\.json$/)
    const match2 = srcFilepath.match(/^plugin:\/\/client\/tutorials\/(.*)\.json$/)
    const match = match1 || match2
    if (match) {
      try {
        // require versus import to work with babelized headless
        const file = match1 ? match1[2] : match2[1]
        const data = match1
          ? require('@kui-shell/plugin-' + match1[1] + '/tutorials/' + file + '.json')
          : require('@kui-shell/client/tutorials/' + file + '.json')

        const dir = dirname(dstFilepath)
        if (!this.trie.get(dir)) {
          throw new Error(`Directory does not exist: ${dir}`)
        } else {
          const mountPath = join(dstFilepath, file + '.json')
          this.trie.map(mountPath, { mountPath, data })
        }

        return 'ok'
      } catch (err) {
        throw new Error(`Unable to copy given source into the tutorials VFS: ${srcFilepath}. ${err.message}`)
      }
    } else {
      throw new Error(`Unable to copy given source into the tutorials VFS: ${srcFilepath}`)
    }
  }

  /** Remove filepath */
  public rm(): Promise<void> {
    throw new Error('Unsupported operation')
  }

  /** Fetch contents */
  public async fstat(
    opts: Pick<Arguments, 'REPL' | 'parsedOptions'>,
    filepath: string,
    withData: boolean,
    enoentOk: boolean
  ): Promise<FStat> {
    const entries = this.trie.get(filepath)
    if (entries.length === 0) {
      if (enoentOk) {
      } else {
        const error: CodedError = new Error(`File not found: ${filepath}`)
        error.code = 404
        throw error
      }
    } else if (entries.length > 1) {
      throw new Error('Multiple matches for fstat')
    } else {
      const entry = entries[0]
      return {
        viewer: 'replay --new-window',
        filepath: entry.mountPath,
        fullpath: entry.mountPath,
        isDirectory: isDirectory(entry),
        data: withData && !isDirectory(entry) ? JSON.stringify(entry.data, undefined, 2) : undefined
      }
    }
  }

  /** Create a directory/bucket */
  public async mkdir(opts: Pick<Arguments, 'argvNoOptions'>): Promise<void> {
    const mountPath = opts.argvNoOptions[opts.argvNoOptions.indexOf('mkdir') + 1]
    this.trie.map(mountPath, { mountPath })
  }

  /** Remove a directory/bucket */
  public rmdir(): Promise<void> {
    throw new Error('Unsupported operation')
  }
}

const vfs = new TutorialVFS()
export default vfs

export function preload() {
  mount(vfs)
}