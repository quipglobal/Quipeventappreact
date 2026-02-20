import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, Star } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { mockSurveys } from '@/app/data/mockData';
import { Survey, SurveyQuestion } from '@/app/types/config';

interface SurveysListPageProps {
  onBack: () => void;
}

export const SurveysListPage: React.FC<SurveysListPageProps> = ({ onBack }) => {
  const { completedSurveys, setCompletedSurveys, inProgressSurveys, setInProgressSurvey, addPoints, gamificationConfig } = useApp();
  const { t } = useTheme();
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const selectedSurveyData = selectedSurvey ? mockSurveys.find(s => s.id === selectedSurvey) : null;
  const handleAnswer = (qId: string, val: any) => setAnswers({ ...answers, [qId]: val });

  const handleNext = () => {
    if (selectedSurveyData && currentQuestion < selectedSurveyData.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setInProgressSurvey(selectedSurvey!, { currentQuestion: currentQuestion + 1, answers });
    }
  };
  const handlePrevious = () => { if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1); };
  const handleSubmit = () => {
    if (selectedSurvey && !completedSurveys.includes(selectedSurvey)) {
      setCompletedSurveys([...completedSurveys, selectedSurvey]);
      addPoints(gamificationConfig.pointActions.completeSurvey, 'Survey completed!');
      setSelectedSurvey(null); setCurrentQuestion(0); setAnswers({});
    }
  };

  const renderQuestion = (question: SurveyQuestion) => {
    const selStyle = (sel: boolean) => ({
      background: sel ? t.accentBg : t.inputBg,
      border: `1.5px solid ${sel ? t.borderAcc : t.border}`,
      color: sel ? t.accentSoft : t.text,
      padding: '14px 16px', borderRadius: 12, textAlign: 'left' as const, width: '100%', fontWeight: sel ? 700 : 500, fontSize: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s',
    });
    switch (question.type) {
      case 'rating': case 'nps': {
        const max = question.type === 'nps' ? 10 : 5;
        return (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: max }, (_, i) => i + 1).map(r => (
              <button key={r} onClick={() => handleAnswer(question.id, r)}
                style={{ width: 46, height: 46, borderRadius: 12, fontWeight: 700, fontSize: 15, background: answers[question.id] === r ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : t.surface2, color: answers[question.id] === r ? '#fff' : t.textSec, border: `1.5px solid ${answers[question.id] === r ? t.borderAcc : t.border}`, transform: answers[question.id] === r ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.15s' }}>
                {r}
              </button>
            ))}
          </div>
        );
      }
      case 'single':
        return (
          <div className="space-y-2">
            {question.options?.map(opt => {
              const sel = answers[question.id] === opt;
              return (
                <button key={opt} onClick={() => handleAnswer(question.id, opt)} style={selStyle(sel)}>
                  <span>{opt}</span>
                  {sel && <CheckCircle style={{ width: 18, height: 18, color: t.accentSoft, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        );
      case 'multi': {
        const selOpts = answers[question.id] || [];
        return (
          <div className="space-y-2">
            {question.options?.map(opt => {
              const sel = selOpts.includes(opt);
              return (
                <button key={opt} onClick={() => handleAnswer(question.id, sel ? selOpts.filter((o: string) => o !== opt) : [...selOpts, opt])} style={selStyle(sel)}>
                  <span>{opt}</span>
                  {sel && <CheckCircle style={{ width: 18, height: 18, color: t.accentSoft, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        );
      }
      case 'text':
        return <input type="text" value={answers[question.id] || ''} onChange={e => handleAnswer(question.id, e.target.value)} placeholder="Type your answer…" className="w-full px-4 py-3 rounded-xl outline-none" style={{ background: t.inputBg, border: `1.5px solid ${t.border}`, color: t.text, fontSize: 14 }} />;
      case 'long_text':
        return <textarea value={answers[question.id] || ''} onChange={e => handleAnswer(question.id, e.target.value)} placeholder="Type your answer…" rows={4} className="w-full px-4 py-3 rounded-xl outline-none resize-none" style={{ background: t.inputBg, border: `1.5px solid ${t.border}`, color: t.text, fontSize: 14 }} />;
      default: return null;
    }
  };

  if (selectedSurveyData) {
    const q = selectedSurveyData.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / selectedSurveyData.questions.length) * 100;
    const isLast = currentQuestion === selectedSurveyData.questions.length - 1;
    const canProceed = answers[q.id] !== undefined && answers[q.id] !== '' && (Array.isArray(answers[q.id]) ? answers[q.id].length > 0 : true);
    return (
      <div className="min-h-screen pb-20" style={{ background: t.bgPage }}>
        <div className="sticky top-0 z-10 px-5 pt-12 pb-5 text-white" style={{ background: 'linear-gradient(135deg,#10b981,#0d9488)' }}>
          <button onClick={() => { setSelectedSurvey(null); setCurrentQuestion(0); }} className="mb-3"><ArrowLeft style={{ width: 22, height: 22, color: '#fff' }} /></button>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>{selectedSurveyData.title}</h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2, marginBottom: 12 }}>{selectedSurveyData.description}</p>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.25)' }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: '#fff', transition: 'width 0.3s' }} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 6 }}>Question {currentQuestion + 1} of {selectedSurveyData.questions.length}</p>
        </div>
        <div className="px-5 py-6">
          <div className="rounded-3xl p-6 mb-5" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
            <h2 style={{ color: t.text, fontSize: 18, fontWeight: 700, marginBottom: q.required ? 6 : 16 }}>{q.question}</h2>
            {q.required && <span style={{ color: t.errorText, fontSize: 12, display: 'block', marginBottom: 14 }}>* Required</span>}
            {renderQuestion(q)}
          </div>
          <div className="flex gap-3">
            {currentQuestion > 0 && (
              <button onClick={handlePrevious} className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: t.surface2, border: `1.5px solid ${t.border}`, color: t.textSec }}>Previous</button>
            )}
            <button onClick={isLast ? handleSubmit : handleNext} disabled={q.required && !canProceed}
              className="flex-1 py-3 rounded-xl font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#10b981,#0d9488)', opacity: q.required && !canProceed ? 0.5 : 1, cursor: q.required && !canProceed ? 'not-allowed' : 'pointer' }}>
              {isLast ? `Submit (+${gamificationConfig.pointActions.completeSurvey} pts)` : 'Next'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: t.bgPage }}>
      <div className="sticky top-0 z-10 px-5 pt-12 pb-6 text-white" style={{ background: 'linear-gradient(135deg,#10b981,#0d9488)' }}>
        <button onClick={onBack} className="mb-3"><ArrowLeft style={{ width: 22, height: 22, color: '#fff' }} /></button>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Surveys</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>Complete surveys to earn +{gamificationConfig.pointActions.completeSurvey} points each</p>
      </div>
      <div className="px-5 py-5 space-y-4">
        {mockSurveys.map(survey => {
          const isDone = completedSurveys.includes(survey.id);
          return (
            <button key={survey.id} onClick={() => !isDone && setSelectedSurvey(survey.id)}
              className="w-full rounded-2xl p-5 text-left transition-all"
              style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${isDone ? t.borderAcc : t.border}`, opacity: isDone ? 0.75 : 1, cursor: isDone ? 'default' : 'pointer' }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>{survey.title}</h3>
                {isDone
                  ? <CheckCircle style={{ width: 22, height: 22, color: t.successText, flexShrink: 0 }} />
                  : <div className="px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: t.successBg }}><span style={{ color: t.successText, fontSize: 12, fontWeight: 700 }}>+{gamificationConfig.pointActions.completeSurvey} pts</span></div>}
              </div>
              <p style={{ color: t.textSec, fontSize: 13, marginBottom: 12 }}>{survey.description}</p>
              <div className="flex items-center gap-3">
                <span style={{ color: t.textMuted, fontSize: 12 }}>{survey.questions.length} questions</span>
                {survey.estimatedTime && <span style={{ color: t.textMuted, fontSize: 12 }}>· ~{survey.estimatedTime}</span>}
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(s => <Star key={s} style={{ width: 12, height: 12, color: s <= (survey.difficulty ?? 3) ? '#f59e0b' : t.emptyIcon, fill: s <= (survey.difficulty ?? 3) ? '#f59e0b' : 'none' }} />)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};