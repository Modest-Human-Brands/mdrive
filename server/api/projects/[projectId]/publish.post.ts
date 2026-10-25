import { defineEventHandler, getRouterParam, HTTPError, readValidatedBody } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'

import type { Resource } from '~/server/types'
import notion from '~/server/utils/notion'
import notionNormalizeId from '~/server/utils/notion-normalize-id'

const publishSchema = z.object({
  notify: z.boolean(),
})

export default defineEventHandler(async (event) => {
  try {
    const projectId = notionNormalizeId(getRouterParam(event, 'projectId')!.toString().replace(/,$/, ''))

    const { notify } = await readValidatedBody(event, publishSchema)

    const projectStorage = useStorage<Resource<'project'>>(`data:resource:project`)

    const filteredProject = (await projectStorage.getItem(projectId))?.record

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

    /* Migrate to Modest Human Brands
    if (notify) {
      console.log(`[DISPATCH] Sending Email via MConnect API`)

      const contactId = filteredProject.properties.Client?.relation[0]?.id

      if (contactId) {
        const contacts = (await contactStorage.getItems(await contactStorage.getKeys())).flatMap(({ value }) => value?.record || [])
        const filteredClient = contacts.find((c) => c.id === contactId)

        await $fetch('/api/interaction/email/send', {
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
                id: 'modest-human-brands',
                name: 'Modest Human Brands',
                legalName: 'Modest Human Brands LLP',
                entityType: 'LLP',
                tradeRelationship: 'Primary',
                gstin: undefined,
                pan: 'ABCDE0123F',
                address: '17 NO, N S Road,harinavi Beltola, South 24 Parganas, West Bengal, India',
                foundedYear: 2025,
                accountDetails: {
                  accountName: 'Modest Human Brands LLP',
                  accountNumber: 1_234_567_890,
                  bankName: 'HDFC Bank',
                  ifscCode: 'HDFC0001234',
                },
                website: 'https://modesthumanbrands.com',
                contactEmail: 'contact@modesthumanbrands.com',
                billingEmail: 'billing@modesthumanbrands.com',
                primaryContactId: 'contact-1',
                organizationMemberIds: ['member-1'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                branding: {
                  logo: 'https://modesthumanbrands.com/logo.svg',
                  color: {
                    primary: '#111827',
                    accent: '#5945EA',
                  },
                  font: 'Exo2',
                },
                phone: '+919999999999',
                whatsapp: '+919999999999',
                socials: {
                  instagram: 'https://www.instagram.com/modesthumanbrands/',
                  facebook: 'https://facebook.com/modesthumanbrands',
                  linkedin: 'https://linkedin.com/company/modest-human-brands',
                  youtube: 'https://www.youtube.com/@modesthumanbrands',
                },
              },
            },
          },
        })
      }
    } */

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
