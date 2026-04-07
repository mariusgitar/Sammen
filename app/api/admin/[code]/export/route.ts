import { and, asc, eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { getDb } from '@/db';
import { innspill, innspillThemes, items, responses, sessions, themes } from '@/db/schema';

const ADMIN_COOKIE_NAME = 'admin_session';

function normalizeTagKey(tag: string) {
  return tag.trim().toLowerCase();
}

async function getSha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const cookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const password = process.env.ADMIN_PASSWORD || '';

  if (!cookieValue || !password) {
    return false;
  }

  const expectedHash = await getSha256Hex(password);
  return cookieValue === expectedHash;
}

function appendSheetWithHeaders(workbook: XLSX.WorkBook, name: string, headers: string[], rows: Array<Record<string, string | number>>) {
  const aoaRows = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))];
  const sheet = XLSX.utils.aoa_to_sheet(aoaRows);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const isAdmin = await isAdminRequest(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const code = params.code.toUpperCase();

    const [session] = await db
      .select({
        id: sessions.id,
        mode: sessions.mode,
        phase: sessions.phase,
        votingType: sessions.votingType,
      })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const allItems = await db
      .select({
        id: items.id,
        text: items.text,
        is_question: items.isQuestion,
        excluded: items.excluded,
        default_tag: items.defaultTag,
        final_tag: items.finalTag,
      })
      .from(items)
      .where(eq(items.sessionId, session.id))
      .orderBy(asc(items.orderIndex), asc(items.createdAt));

    const allResponses = await db
      .select({
        item_id: responses.itemId,
        value: responses.value,
        participant_id: responses.participantId,
      })
      .from(responses)
      .where(eq(responses.sessionId, session.id));

    const allInnspill = await db
      .select({
        id: innspill.id,
        question_id: innspill.questionId,
        text: innspill.text,
        likes: innspill.likes,
        participant_id: innspill.participantId,
      })
      .from(innspill)
      .where(eq(innspill.sessionId, session.id));

    const sessionThemes = await db
      .select({ id: themes.id, name: themes.name })
      .from(themes)
      .where(eq(themes.sessionId, session.id));

    const themeLinks =
      sessionThemes.length > 0
        ? await db
            .select({ innspill_id: innspillThemes.innspillId, theme_id: innspillThemes.themeId })
            .from(innspillThemes)
            .where(inArray(innspillThemes.themeId, sessionThemes.map((theme) => theme.id)))
        : [];

    const workbook = XLSX.utils.book_new();

    const nonQuestionItems = allItems.filter((item) => !item.is_question);

    const kartleggingRows = nonQuestionItems.map((item) => {
      const itemResponses = allResponses.filter((response) => response.item_id === item.id);
      const tagCounts: Record<string, number> = {};

      if (item.default_tag !== null) {
        tagCounts[item.default_tag] = (tagCounts[item.default_tag] ?? 0) + 1;
      }

      for (const response of itemResponses) {
        tagCounts[response.value] = (tagCounts[response.value] ?? 0) + 1;
      }

      const totalVotes = Object.values(tagCounts).reduce((sum, count) => sum + count, 0);
      const highestTagCount = Object.values(tagCounts).reduce((max, count) => Math.max(max, count), 0);
      const agreement = totalVotes > 0 ? (highestTagCount / totalVotes) * 100 : 0;

      const sortedDistribution = Object.entries(tagCounts).sort((a, b) => {
        if (a[0] === b[0]) {
          return 0;
        }

        if (item.final_tag && normalizeTagKey(a[0]) === normalizeTagKey(item.final_tag)) {
          return -1;
        }

        if (item.final_tag && normalizeTagKey(b[0]) === normalizeTagKey(item.final_tag)) {
          return 1;
        }

        return b[1] - a[1];
      });

      return {
        Element: item.text,
        'Default tag (fasilitator)': item.default_tag ?? '',
        'Final tag': item.final_tag ?? '',
        Stemmefordeling: sortedDistribution.map(([tag, count]) => `${tag}: ${count}`).join(' / '),
        'Enighet (%)': Number(agreement.toFixed(1)),
        'Tatt med videre': item.excluded ? 'Nei' : 'Ja',
      };
    });

    const hasKartleggingData =
      session.mode === 'kartlegging' ||
      kartleggingRows.some((row) => row['Default tag (fasilitator)'] || row['Final tag'] || row.Stemmefordeling);

    if (hasKartleggingData) {
      appendSheetWithHeaders(
        workbook,
        'Kartlegging',
        ['Element', 'Default tag (fasilitator)', 'Final tag', 'Stemmefordeling', 'Enighet (%)', 'Tatt med videre'],
        kartleggingRows,
      );
    }

    const votesByItem = new Map<string, Array<{ numericValue: number; originalValue: string }>>();
    for (const response of allResponses) {
      const numericValue = Number(response.value);
      if (!Number.isFinite(numericValue)) {
        continue;
      }
      const current = votesByItem.get(response.item_id) ?? [];
      current.push({ numericValue, originalValue: response.value });
      votesByItem.set(response.item_id, current);
    }

    const hasScaleVotes = allResponses.some((response) => {
      const n = Number(response.value);
      return Number.isInteger(n) && n >= 1 && n <= 5;
    });
    const hasDotVotes = allResponses.some((response) => {
      const n = Number.parseInt(response.value, 10);
      return Number.isInteger(n) && n > 0;
    });

    if (session.votingType === 'dots' && hasDotVotes) {
      const stemmingRows = nonQuestionItems
        .map((item) => {
          const itemVotes = (votesByItem.get(item.id) ?? []).filter((vote) => Number.isInteger(vote.numericValue) && vote.numericValue >= 0);
          const totalDots = itemVotes.reduce((sum, vote) => sum + Number.parseInt(vote.originalValue, 10), 0);

          return {
            Element: item.text,
            Tag: item.final_tag ?? item.default_tag ?? '',
            'Totale dots': totalDots,
            'Antall stemmer': itemVotes.length,
          };
        })
        .filter((item) => item['Antall stemmer'] > 0);

      if (stemmingRows.length > 0) {
        appendSheetWithHeaders(workbook, 'Stemming', ['Element', 'Tag', 'Totale dots', 'Antall stemmer'], stemmingRows);
      }
    } else if (hasScaleVotes || session.phase === 'stemming' || session.mode === 'stemming') {
      const stemmingRows = nonQuestionItems
        .map((item) => {
          const itemVotes = (votesByItem.get(item.id) ?? [])
            .map((vote) => vote.numericValue)
            .filter((vote) => Number.isInteger(vote) && vote >= 1 && vote <= 5);

          const voteCount = itemVotes.length;
          const average = voteCount > 0 ? itemVotes.reduce((sum, vote) => sum + vote, 0) / voteCount : 0;
          const stdDev = voteCount > 0
            ? Math.sqrt(itemVotes.reduce((sum, vote) => sum + Math.pow(vote - average, 2), 0) / voteCount)
            : 0;

          const distribution = {
            '1': 0,
            '2': 0,
            '3': 0,
            '4': 0,
            '5': 0,
          };

          for (const vote of itemVotes) {
            distribution[String(vote) as keyof typeof distribution] += 1;
          }

          return {
            Element: item.text,
            Tag: item.final_tag ?? item.default_tag ?? '',
            Snitt: Number(average.toFixed(2)),
            'Antall stemmer': voteCount,
            'Fordeling (1:x 2:x 3:x 4:x 5:x)': `1:${distribution['1']} 2:${distribution['2']} 3:${distribution['3']} 4:${distribution['4']} 5:${distribution['5']}`,
            StdDev: Number(stdDev.toFixed(2)),
          };
        })
        .filter((item) => item['Antall stemmer'] > 0);

      if (stemmingRows.length > 0) {
        appendSheetWithHeaders(
          workbook,
          'Stemming',
          ['Element', 'Tag', 'Snitt', 'Antall stemmer', 'Fordeling (1:x 2:x 3:x 4:x 5:x)', 'StdDev'],
          stemmingRows,
        );
      }
    }

    if (session.mode === 'rangering' || session.phase === 'rangering') {
      const rangeringRows = nonQuestionItems
        .map((item) => {
          const positions = allResponses
            .filter((response) => response.item_id === item.id)
            .map((response) => Number(response.value))
            .filter((value) => Number.isInteger(value) && value > 0);

          if (positions.length === 0) {
            return null;
          }

          const average = positions.reduce((sum, value) => sum + value, 0) / positions.length;

          return {
            Element: item.text,
            Snittposisjon: Number(average.toFixed(2)),
            'Antall stemmer': positions.length,
            'Min posisjon': Math.min(...positions),
            'Maks posisjon': Math.max(...positions),
          };
        })
        .filter((row): row is { Element: string; Snittposisjon: number; 'Antall stemmer': number; 'Min posisjon': number; 'Maks posisjon': number } => row !== null)
        .sort((a, b) => a.Snittposisjon - b.Snittposisjon);

      if (rangeringRows.length > 0) {
        appendSheetWithHeaders(
          workbook,
          'Rangering',
          ['Element', 'Snittposisjon', 'Antall stemmer', 'Min posisjon', 'Maks posisjon'],
          rangeringRows,
        );
      }
    }

    if (allInnspill.length > 0) {
      const questions = await db
        .select({ id: items.id, text: items.text })
        .from(items)
        .where(and(eq(items.sessionId, session.id), eq(items.isQuestion, true)));

      const questionById = new Map(questions.map((question) => [question.id, question.text]));
      const themeById = new Map(sessionThemes.map((theme) => [theme.id, theme.name]));
      const themeIdsByInnspillId = new Map<string, string[]>();

      for (const link of themeLinks) {
        const existing = themeIdsByInnspillId.get(link.innspill_id) ?? [];
        existing.push(link.theme_id);
        themeIdsByInnspillId.set(link.innspill_id, existing);
      }

      const innspillRows = allInnspill.map((entry) => {
        const assignedThemeNames = (themeIdsByInnspillId.get(entry.id) ?? [])
          .map((themeId) => themeById.get(themeId))
          .filter((name): name is string => Boolean(name));

        return {
          Spørsmål: questionById.get(entry.question_id) ?? 'Ukjent spørsmål',
          'Innspill-tekst': entry.text,
          Tema: assignedThemeNames.join(', '),
          Likes: entry.likes,
          'Deltaker-ID': entry.participant_id,
        };
      });

      appendSheetWithHeaders(workbook, 'Innspill', ['Spørsmål', 'Innspill-tekst', 'Tema', 'Likes', 'Deltaker-ID'], innspillRows);
    }

    if (workbook.SheetNames.length === 0) {
      appendSheetWithHeaders(workbook, 'Rapport', ['Melding'], [{ Melding: 'Ingen data å eksportere ennå.' }]);
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="sammen-${code}-rapport.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
