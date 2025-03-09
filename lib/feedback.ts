import { streamText } from 'ai'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { languagePrompt, systemPrompt } from './prompt'
import { useAiModel } from '~/composables/useAiProvider'
import { parseStreamingJson, type DeepPartial } from '~~/utils/json'
import { throwAiError } from '~~/utils/errors'

type PartialFeedback = DeepPartial<z.infer<typeof feedbackTypeSchema>>

export const feedbackTypeSchema = z.object({
  questions: z.array(z.string()),
})

export function generateFeedback({
  query,
  language,
  numQuestions = 3,
}: {
  query: string
  language: string
  numQuestions?: number
}) {
  const schema = z.object({
    questions: z
      .array(z.string())
      .describe(`Follow up questions to clarify the research direction`),
  })
  const jsonSchema = JSON.stringify(zodToJsonSchema(schema))
  const prompt = [
    `Given the following query from the user, ask several follow up questions to clarify the research direction. Return a maximum of ${numQuestions} questions. Feel free to return less if the original query is clear, but always provide at least 1 question.`,
    `<query>${query}</query>`,
    `You MUST respond in JSON matching this JSON schema: ${jsonSchema}`,
    languagePrompt(language),
  ].join('\n\n')

  const stream = streamText({
    model: useAiModel(),
    system: systemPrompt(),
    prompt,
    onError({ error }) {
      throwAiError('generateFeedback', error)
    },
  })

  return parseStreamingJson(
    stream.fullStream,
    feedbackTypeSchema,
    (value: PartialFeedback) => !!value.questions && value.questions.length > 0,
  )
}
