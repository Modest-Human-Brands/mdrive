import { defineEventHandler, getRouterParam, HTTPError, readValidatedBody } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { z } from 'zod'
import { ofetch } from 'ofetch'

import type { Resource } from '~/server/types'
import notion from '~/server/utils/notion'
import notionTextStringify from '~/server/utils/notion-text-stringify'

const publishSchema = z.object({
  notify: z.boolean(),
})

export default defineEventHandler(async (event) => {
  try {
    const projectId = getRouterParam(event, 'projectId')!.toString().replace(/,$/, '')

    const { notify } = await readValidatedBody(event, publishSchema)

    const projectStorage = useStorage<Resource<'project'>>(`data:resource:project`)
    const contactStorage = useStorage<Resource<'contact'>>(`data:resource:contact`)

    const projectKeys = await projectStorage.getKeys()
    const projects = (await projectStorage.getItems(projectKeys)).flatMap(({ value }) => value?.record || [])

    const config = useRuntimeConfig()

    const filteredProject = projects.find(({ properties }) => properties.Slug.formula.string === projectId)

    if (!filteredProject) {
      throw new HTTPError({ statusCode: 404, statusMessage: 'Project not found' })
    }

    console.log(`[STATE UPDATE] Updating Notion page ${filteredProject.id} to "Published"`)
    await notion.pages.update({
      page_id: filteredProject.id,
      properties: {
        Status: {
          status: {
            name: 'Delivered',
          },
        },
      },
    })

    if (notify) {
      console.log(`[DISPATCH] Sending Email via MConnect API`)

      const contactId = filteredProject.properties.Client?.relation[0]?.id

      if (contactId) {
        const contacts = (await contactStorage.getItems(await contactStorage.getKeys())).flatMap(({ value }) => value?.record || [])
        const filteredClient = contacts.find((c) => c.id === contactId)

        await ofetch('/api/connect/text/email/send', {
          baseURL: config.private.mconnectUrl,
          method: 'POST',
          body: {
            contactId: contactId,
            channel: 'email',
            template: 'project-delivery',
            variables: {
              clientName: notionTextStringify(filteredClient!.properties.Name.title),
              projectName: notionTextStringify(filteredProject.properties.Name.title),
              completionDate: filteredProject.properties.Date.date.end,
              deliveryNotes: `Your gallery for project ${notionTextStringify(filteredProject.properties.Name.title)} is ready for review!`,
              projectLinks: [
                {
                  title: 'View Gallery',
                  url: `https://modesthumanbrands.com/drive/public/red-cat-pictures/${filteredProject.properties.Slug.formula.string}`,
                  description: 'MDrive gallery view to review',
                },
              ],
              organization: {
                id: 'red-cat-pictures',
                name: 'RED CAT PICTURES',
                website: 'https://redcatpictures.com',
                branding: {
                  logo: 'https://redcatpictures.com/logo-dark.svg',
                  color: { primary: '#CD2D2D', accent: '#000000' },
                  font: 'Exo2',
                },
                socials: {},
              },
            },
          },
        })
      }
    }

    return {
      notify,
    }
  } catch (error: any) {
    console.error('API projects/[projectId]/publish POST Error:', error)

    const statusCode = error.status || error.statusCode || 500
    const statusMessage = error.message || 'Internal Server Error'

    throw new HTTPError({
      statusCode,
      statusMessage,
    })
  }
})
