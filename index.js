import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import fs from 'fs'
import readline from 'readline'

class MissingEnv extends Error {
  constructor(name) {
    super(`You must provide ${name} as an environement variable`)
    this.name = MissingEnv.name
  }
}

/**
 * 
 * @param {string} name 
 * @returns {string}
 */
const envOrThrow = name => {
  const res = process.env[name]
  if (res) {
    return res
  }
  throw new MissingEnv(name)
}

/**
 * @returns {string[]}
 */
const getSkips = () => {
  if (!fs.existsSync('./skip.txt')) {
    return []
  }
  const skips = []
  const raw = fs.readFileSync('./skip.txt').toString('utf-8')
  for (const l of raw.split('\n')) {
    if (l.length === 0) {
      continue
    }
    skips.push(l.trim())
  }
  return skips
}

/**
 * 
 * @param {google.cloud.secretmanager.v1.ISecret[]} skipped
 * @returns {string}
 */
const displaySkipped = (skipped) => {
  let str = ''
  for (const s of skipped) {
    const [_projects, _projectsId, _secrets, name] = s.name.split('/')
    if (!name) {
      continue
    }
    str += `- ${name}\n`
  }
  return str
}

/**
 * 
 * @param {google.cloud.secretmanager.v1.ISecret[]} secrets 
 * @param {string[]} skips 
 * @returns {google.cloud.secretmanager.v1.ISecret[]}
 */
const whatToDelete = (secrets, skips) => {
  const toDelete = []
  const skipped = []

  for (const s of secrets) {
    const [_projects, _projectsId, _secrets, name] = s.name.split('/')
    if (!name) {
      continue
    }
    if (skips.find(n => n === name)) {
      skipped.push(s)
    } else {
      toDelete.push(s)
    }
  }

  return { toDelete, skipped }
}

/**
 * 
 * @param {SecretManagerServiceClient} client
 * @param {google.cloud.secretmanager.v1.ISecret[]} secrets
 * @returns {Promise<void>}
 */
const deleteSecrets = async (client, secrets) => {
  for (const { name } of secrets) {
    if (process.env['DRY_RUN'] === 'true') {
      console.log(`DRY_RUN: ${name} deleted.`)
    } else {      
      await client.deleteSecret({ name })
      console.log(`${name} deleted.`)
    }
  }
}

envOrThrow('GOOGLE_APPLICATION_CREDENTIALS')
const project = envOrThrow('PROJECT')

const client = new SecretManagerServiceClient()

const [secrets] = await client.listSecrets({
  parent: project
})
const skips = getSkips()
const { toDelete, skipped } = whatToDelete(secrets, skips)

console.log(`
I will be deleting ${toDelete.length} secrets out of ${secrets.length}.

Here are the ones that I'll skip. You can add skips in the 'skip.txt'.
${displaySkipped(skipped)}
`)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.question('Do you want to proceed? [y/n] ', fstyn => {
  if (fstyn === 'y') {
    rl.question('Are you sure? [y/n] ', yn => {
      if (yn === 'y') {
        console.time('Done in')
        deleteSecrets(client, toDelete).then(() => {
          rl.close()
          console.timeEnd('Done in')
          process.exit(0)
        })
      } else {
        rl.close()
        console.log('\nIf you\'re scared, you can use DRY_RUN\n')
        process.exit(1)
      }
    })  
  } else {
    rl.close()
    console.log('\nIf you\'re scared, you can use DRY_RUN\n')
    process.exit(1)
  }
})
