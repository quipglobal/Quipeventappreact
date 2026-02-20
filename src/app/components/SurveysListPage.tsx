import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, Clock, Star, ChevronRight } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { mockSurveys } from '@/app/data/mockData';
import { Survey, SurveyQuestion } from '@/app/types/config';

interface SurveysListPageProps {
  onBack: () => void;
}

export const SurveysListPage: React.FC<SurveysListPageProps> = ({ onBack }) => {
  const { completedSurveys, setCompletedSurveys, inProgressSurveys, setInProgressSurvey, addPoints, gamificationConfig } = useApp();
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const selectedSurveyData = selectedSurvey ? mockSurveys.find(s => s.id === selectedSurvey) : null;

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers({ ...answers, [questionId]: value });
  };

  const handleNext = () => {
    if (selectedSurveyData && currentQuestion < selectedSurveyData.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setInProgressSurvey(selectedSurvey!, { currentQuestion: currentQuestion + 1, answers });
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = () => {
    if (selectedSurvey && !completedSurveys.includes(selectedSurvey)) {
      setCompletedSurveys([...completedSurveys, selectedSurvey]);
      addPoints(gamificationConfig.pointActions.completeSurvey, 'Survey completed!');
      setSelectedSurvey(null);
      setCurrentQuestion(0);
      setAnswers({});
    }
  };

  const renderQuestion = (question: SurveyQuestion) => {
    switch (question.type) {
      case 'rating':
      case 'nps':
        const maxRating = question.type === 'nps' ? 10 : 5;
        return (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: maxRating }, (_, i) => i + 1).map((rating) => (
              <button
                key={rating}
                onClick={() => handleAnswer(question.id, rating)}
                className={`w-12 h-12 rounded-xl font-bold transition-all ${
                  answers[question.id] === rating
                    ? 'bg-indigo-600 text-white scale-110 shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {rating}
              </button>
            ))}
          </div>
        );

      case 'single':
        return (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <button
                key={option}
                onClick={() => handleAnswer(question.id, option)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  answers[question.id] === option
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${answers[question.id] === option ? 'text-indigo-600' : 'text-gray-900'}`}>
                    {option}
                  </span>
                  {answers[question.id] === option && (
                    <CheckCircle className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
              </button>
            ))}
          </div>
        );

      case 'multi':
        const selectedOptions = answers[question.id] || [];
        return (
          <div className="space-y-2">
            {question.options?.map((option) => {
              const isSelected = selectedOptions.includes(option);
              return (
                <button
                  key={option}
                  onClick={() => {
                    const newSelection = isSelected
                      ? selectedOptions.filter((o: string) => o !== option)
                      : [...selectedOptions, option];
                    handleAnswer(question.id, newSelection);
                  }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${isSelected ? 'text-indigo-600' : 'text-gray-900'}`}>
                      {option}
                    </span>
                    {isSelected && (
                      <CheckCircle className="w-5 h-5 text-indigo-600" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 'text':
        return (
          <input
            type="text"
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswer(question.id, e.target.value)}
            placeholder="Type your answer..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        );

      case 'long_text':
        return (
          <textarea
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswer(question.id, e.target.value)}
            placeholder="Type your answer..."
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        );

      default:
        return null;
    }
  };

  if (selectedSurveyData) {
    const question = selectedSurveyData.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / selectedSurveyData.questions.length) * 100;
    const isLastQuestion = currentQuestion === selectedSurveyData.questions.length - 1;
    const canProceed = answers[question.id] !== undefined && answers[question.id] !== '' && 
                       (Array.isArray(answers[question.id]) ? answers[question.id].length > 0 : true);

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-6 pt-12 pb-6 text-white sticky top-0 z-10">
          <button onClick={() => {
            setSelectedSurvey(null);
            setCurrentQuestion(0);
          }} className="mb-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold mb-1">{selectedSurveyData.title}</h1>
          <p className="text-white/90 text-sm mb-4">{selectedSurveyData.description}</p>
          
          {/* Progress Bar */}
          <div className="bg-white/20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-white h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-white/80 mt-2">
            Question {currentQuestion + 1} of {selectedSurveyData.questions.length}
          </p>
        </div>

        {/* Question */}
        <div className="px-6 py-8">
          <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">{question.question}</h2>
              {question.required && (
                <span className="text-sm text-red-500">* Required</span>
              )}
            </div>

            {renderQuestion(question)}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-3">
            {currentQuestion > 0 && (
              <button
                onClick={handlePrevious}
                className="flex-1 py-3 rounded-xl font-medium bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
              >
                Previous
              </button>
            )}
            <button
              onClick={isLastQuestion ? handleSubmit : handleNext}
              disabled={question.required && !canProceed}
              className="flex-1 py-3 rounded-xl font-medium bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLastQuestion ? `Submit (+${gamificationConfig.pointActions.completeSurvey} pts)` : 'Next'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-6 pt-12 pb-8 text-white sticky top-0 z-10">
        <button onClick={onBack} className="mb-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold mb-1">Surveys</h1>
        <p className="text-white/90 text-sm">Complete surveys to earn +{gamificationConfig.pointActions.completeSurvey} points each</p>
      </div>

      {/* Surveys List */}
      <div className="px-6 py-6 space-y-4">
        {mockSurveys.map((survey) => {
          const isCompleted = completedSurveys.includes(survey.id);
          const isInProgress = inProgressSurveys[survey.id] !== undefined;

          return (
            <button
              key={survey.id}
              onClick={() => !isCompleted && setSelectedSurvey(survey.id)}
              disabled={isCompleted}
              className={`w-full bg-white rounded-2xl shadow-md p-5 text-left transition-all ${
                isCompleted ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-gray-900">{survey.title}</h3>
                    {isCompleted && (
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                  {isInProgress && !isCompleted && (
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full mb-2">
                      In Progress
                    </span>
                  )}
                  {!isCompleted && !isInProgress && (
                    <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full mb-2">
                      New
                    </span>
                  )}
                </div>
                {!isCompleted && (
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                )}
              </div>

              <p className="text-sm text-gray-600 mb-4">{survey.description}</p>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4 text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{survey.estimatedTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    <span>{survey.questions.length} questions</span>
                  </div>
                </div>
                {!isCompleted && (
                  <span className="font-bold text-emerald-600">
                    +{survey.rewardPoints} pts
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
