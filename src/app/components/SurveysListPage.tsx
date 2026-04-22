import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import {
  listEventSurveysApi,
  getEventSurveyApi,
  submitEventSurveyApi,
  BackendSurveySummary,
  BackendSurveyDetail,
  BackendSurveyQuestion,
  SurveyAnswer,
} from '@/app/api/engageClient';

interface SurveysListPageProps { onBack: () => void; }

const isMultiType = (t: string) => t === 'multiChoice' || t === 'multi';
const isSingleType = (t: string) => t === 'singleChoice' || t === 'single';
const isRatingType = (t: string) => t === 'rating';
const isNpsType = (t: string) => t === 'nps';
const isTextType = (t: string) => t === 'text' || t === 'long_text';

const formatAnswer = (q: BackendSurveyQuestion, value: unknown): string => {
  if (Array.isArray(value)) return value.join(', ');
  if (value === undefined || value === null) return '';
  return String(value);
};

export const SurveysListPage: React.FC<SurveysListPageProps> = ({ onBack }) => {
  const { completedSurveys, setCompletedSurveys, addPoints, gamificationConfig, eventConfig, showToast } = useApp();
  const { t } = useTheme();
  const eventId = eventConfig?.eventId;

  const [surveys, setSurveys] = useState<BackendSurveySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedDetail, setSelectedDetail] = useState<BackendSurveyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load list whenever event changes
  useEffect(() => {
    if (!eventId) return;
    let stale = false;
    setLoading(true);
    setLoadError(null);
    setSurveys([]);
    listEventSurveysApi(eventId).then(res => {
      if (stale) return;
      if (res.success && res.data) {
        setSurveys(res.data.filter(s => s.status === 'PUBLISHED' || s.status === 'OPEN'));
      } else {
        setLoadError(res.error?.message ?? 'Failed to load surveys.');
      }
      setLoading(false);
    });
    return () => { stale = true; };
  }, [eventId]);

  const openSurvey = async (surveyId: number) => {
    if (!eventId) return;
    setDetailLoading(true);
    setSelectedDetail(null);
    setAnswers({});
    setCurrentQuestion(0);
    const res = await getEventSurveyApi(eventId, surveyId);
    setDetailLoading(false);
    if (res.success && res.data) {
      const sorted = { ...res.data, questions: [...res.data.questions].sort((a, b) => a.order - b.order) };
      setSelectedDetail(sorted);
    } else {
      showToast(res.error?.message ?? 'Failed to open survey.');
    }
  };

  const handleAnswer = (qId: number, val: unknown) => setAnswers(prev => ({ ...prev, [qId]: val }));

  const handleSubmit = async () => {
    if (!eventId || !selectedDetail || isSubmitting) return;
    if (completedSurveys.includes(String(selectedDetail.id))) return;

    const payload: SurveyAnswer[] = selectedDetail.questions
      .filter(q => answers[q.id] !== undefined && answers[q.id] !== '' && (!Array.isArray(answers[q.id]) || (answers[q.id] as unknown[]).length > 0))
      .map(q => ({ question_id: q.id, answer_text: formatAnswer(q, answers[q.id]) }));

    setIsSubmitting(true);
    const res = await submitEventSurveyApi(eventId, selectedDetail.id, payload);
    setIsSubmitting(false);

    if (res.success) {
      setCompletedSurveys([...completedSurveys, String(selectedDetail.id)]);
      addPoints(gamificationConfig.pointActions.completeSurvey, 'Survey completed!');
      setSelectedDetail(null);
      setCurrentQuestion(0);
      setAnswers({});
    } else if (res.error?.code === 'ALREADY_SUBMITTED') {
      setCompletedSurveys([...completedSurveys, String(selectedDetail.id)]);
      showToast('You already submitted this survey.');
      setSelectedDetail(null);
    } else {
      showToast(res.error?.message ?? 'Failed to submit survey. Please try again.');
    }
  };

  const renderQuestion = (q: BackendSurveyQuestion) => {
    const selStyle = (sel: boolean) => ({
      background: sel ? t.accentBg : t.inputBg,
      border: `1.5px solid ${sel ? t.borderAcc : t.border}`,
      color: sel ? t.accentSoft : t.text,
      padding: '14px 16px', borderRadius: 12, textAlign: 'left' as const, width: '100%',
      fontWeight: sel ? 700 : 500, fontSize: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s',
    });

    if (isRatingType(q.question_type) || isNpsType(q.question_type)) {
      const max = isNpsType(q.question_type) ? 10 : 5;
      return (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: max }, (_, i) => i + 1).map(r => (
            <button key={r} onClick={() => handleAnswer(q.id, r)}
              style={{
                width: 46, height: 46, borderRadius: 12, fontWeight: 700, fontSize: 15,
                background: answers[q.id] === r ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : t.surface2,
                color: answers[q.id] === r ? '#fff' : t.textSec,
                border: `1.5px solid ${answers[q.id] === r ? t.borderAcc : t.border}`,
                transform: answers[q.id] === r ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.15s',
              }}>
              {r}
            </button>
          ))}
        </div>
      );
    }

    if (isSingleType(q.question_type)) {
      return (
        <div className="space-y-2">
          {q.options?.map(opt => {
            const sel = answers[q.id] === opt;
            return (
              <button key={opt} onClick={() => handleAnswer(q.id, opt)} style={selStyle(sel)}>
                <span>{opt}</span>
                {sel && <CheckCircle style={{ width: 18, height: 18, color: t.accentSoft, flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      );
    }

    if (isMultiType(q.question_type)) {
      const selOpts = (answers[q.id] as string[] | undefined) ?? [];
      return (
        <div className="space-y-2">
          {q.options?.map(opt => {
            const sel = selOpts.includes(opt);
            return (
              <button key={opt}
                onClick={() => handleAnswer(q.id, sel ? selOpts.filter(o => o !== opt) : [...selOpts, opt])}
                style={selStyle(sel)}>
                <span>{opt}</span>
                {sel && <CheckCircle style={{ width: 18, height: 18, color: t.accentSoft, flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      );
    }

    if (isTextType(q.question_type)) {
      const isLong = q.question_type === 'long_text';
      return isLong ? (
        <textarea value={(answers[q.id] as string) ?? ''} onChange={e => handleAnswer(q.id, e.target.value)}
          placeholder="Type your answer…" rows={4}
          className="w-full px-4 py-3 rounded-xl outline-none resize-none"
          style={{ background: t.inputBg, border: `1.5px solid ${t.border}`, color: t.text, fontSize: 14 }} />
      ) : (
        <input type="text" value={(answers[q.id] as string) ?? ''} onChange={e => handleAnswer(q.id, e.target.value)}
          placeholder="Type your answer…"
          className="w-full px-4 py-3 rounded-xl outline-none"
          style={{ background: t.inputBg, border: `1.5px solid ${t.border}`, color: t.text, fontSize: 14 }} />
      );
    }

    return null;
  };

  // ─── Detail (taking survey) ──────────────────────────────────────────────
  if (selectedDetail) {
    const q = selectedDetail.questions[currentQuestion];
    if (!q) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: t.bgPage, color: t.textSec }}>
          This survey has no questions yet.
        </div>
      );
    }
    const total = selectedDetail.questions.length;
    const progress = ((currentQuestion + 1) / total) * 100;
    const isLast = currentQuestion === total - 1;
    const val = answers[q.id];
    const hasAnswer = val !== undefined && val !== '' && (!Array.isArray(val) || val.length > 0);
    const canProceed = !q.is_required || hasAnswer;

    return (
      <div className="min-h-screen pb-20" style={{ background: t.bgPage }}>
        <div className="sticky top-0 z-10 px-5 pt-12 pb-5 text-white" style={{ background: 'linear-gradient(135deg,#10b981,#0d9488)' }}>
          <button onClick={() => { setSelectedDetail(null); setCurrentQuestion(0); }} className="mb-3">
            <ArrowLeft style={{ width: 22, height: 22, color: '#fff' }} />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>{selectedDetail.title}</h1>
          {selectedDetail.description && (
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2, marginBottom: 12 }}>{selectedDetail.description}</p>
          )}
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.25)' }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: '#fff', transition: 'width 0.3s' }} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 6 }}>Question {currentQuestion + 1} of {total}</p>
        </div>
        <div className="px-5 py-6">
          <div className="rounded-3xl p-6 mb-5" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
            <h2 style={{ color: t.text, fontSize: 18, fontWeight: 700, marginBottom: q.is_required ? 6 : 16 }}>{q.question_text}</h2>
            {q.is_required && <span style={{ color: t.errorText, fontSize: 12, display: 'block', marginBottom: 14 }}>* Required</span>}
            {renderQuestion(q)}
          </div>
          <div className="flex gap-3">
            {currentQuestion > 0 && (
              <button onClick={() => setCurrentQuestion(c => Math.max(0, c - 1))} className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: t.surface2, border: `1.5px solid ${t.border}`, color: t.textSec }}>
                Previous
              </button>
            )}
            <button
              onClick={isLast ? handleSubmit : () => setCurrentQuestion(c => c + 1)}
              disabled={!canProceed || isSubmitting}
              className="flex-1 py-3 rounded-xl font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg,#10b981,#0d9488)',
                opacity: !canProceed || isSubmitting ? 0.5 : 1,
                cursor: !canProceed || isSubmitting ? 'not-allowed' : 'pointer',
              }}>
              {isLast ? (isSubmitting ? 'Submitting…' : `Submit (+${gamificationConfig.pointActions.completeSurvey} pts)`) : 'Next'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── List ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-20" style={{ background: t.bgPage }}>
      <div className="sticky top-0 z-10 px-5 pt-12 pb-6 text-white" style={{ background: 'linear-gradient(135deg,#10b981,#0d9488)' }}>
        <button onClick={onBack} className="mb-3"><ArrowLeft style={{ width: 22, height: 22, color: '#fff' }} /></button>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Surveys</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>
          Complete surveys to earn +{gamificationConfig.pointActions.completeSurvey} points each
        </p>
      </div>

      <div className="px-5 py-5 space-y-4">
        {(loading || detailLoading) && (
          <div className="flex items-center justify-center py-16" style={{ color: t.textMuted }}>
            <Loader2 className="animate-spin" style={{ width: 28, height: 28 }} />
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-2xl p-5" style={{ background: t.errorBg, color: t.errorText, fontSize: 13 }}>
            {loadError}
          </div>
        )}

        {!loading && !loadError && surveys.length === 0 && (
          <div className="rounded-2xl p-10 text-center" style={{ background: t.surface, color: t.textMuted, border: `1px solid ${t.border}` }}>
            No surveys are available yet.
          </div>
        )}

        {!loading && !detailLoading && surveys.map(survey => {
          const isDone = completedSurveys.includes(String(survey.id));
          return (
            <button key={survey.id} onClick={() => !isDone && openSurvey(survey.id)}
              className="w-full rounded-2xl p-5 text-left transition-all"
              style={{
                background: t.surface, boxShadow: t.shadow,
                border: `1px solid ${isDone ? t.borderAcc : t.border}`,
                opacity: isDone ? 0.75 : 1, cursor: isDone ? 'default' : 'pointer',
              }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>{survey.title}</h3>
                {isDone
                  ? <CheckCircle style={{ width: 22, height: 22, color: t.successText, flexShrink: 0 }} />
                  : <div className="px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: t.successBg }}>
                      <span style={{ color: t.successText, fontSize: 12, fontWeight: 700 }}>+{gamificationConfig.pointActions.completeSurvey} pts</span>
                    </div>}
              </div>
              {survey.description && (
                <p style={{ color: t.textSec, fontSize: 13, marginBottom: 12 }}>{survey.description}</p>
              )}
              {typeof survey.questions_count === 'number' && (
                <span style={{ color: t.textMuted, fontSize: 12 }}>{survey.questions_count} questions</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
