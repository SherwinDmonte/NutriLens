import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import { AuthenticatedAppShell } from '../components/auth/AuthenticatedAppShell.jsx';
import { AddFoodDialog } from '../components/dashboard/AddFoodDialog.jsx';
import { DeleteFoodDialog } from '../components/dashboard/DeleteFoodDialog.jsx';
import { DailyMealLog } from '../components/dashboard/MealSections.jsx';
import {
  FiberIntakeCard,
  NutritionProgressGrid,
} from '../components/dashboard/NutritionProgress.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Toast } from '../components/ui/Feedback.jsx';
import { useAuth } from '../context/authContext.js';
import { useDailyDashboard } from '../hooks/useDailyDashboard.js';
import { useCurrentMoment } from '../hooks/useCurrentMoment.js';
import {
  formatCalendarDate,
  getTodayCalendarDate,
  isFutureCalendarDate,
  resolveCalendarDate,
  shiftCalendarDate,
} from '../utils/calendarDate.js';
import { formatNutritionNumber } from '../utils/nutritionProgress.js';

const mealLabels = Object.freeze({
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
});

function greetingForCurrentTime(currentMoment) {
  const hour = currentMoment.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-loading" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading nutrition data for the selected date.</span>
      <div className="nutrition-progress-skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="dashboard-skeleton nutrition-progress-skeleton" key={index} />
        ))}
      </div>
      <div className="dashboard-content-grid">
        <div className="dashboard-skeleton dashboard-skeleton-panel" />
        <div className="dashboard-skeleton dashboard-skeleton-panel dashboard-skeleton-panel-short" />
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }) {
  return (
    <section className="dashboard-error" role="alert">
      <span aria-hidden="true">
        <RefreshCw size={22} />
      </span>
      <div>
        <p className="dashboard-kicker">Daily data unavailable</p>
        <h2>We couldn’t load this date.</h2>
        <p>{error?.message || 'Check your connection and try again.'}</p>
      </div>
      <Button variant="secondary" type="button" onClick={onRetry}>
        <RefreshCw size={16} aria-hidden="true" /> Retry
      </Button>
    </section>
  );
}

export function DashboardPage() {
  const currentMoment = useCurrentMoment();
  const [dateSearchParams, setDateSearchParams] = useSearchParams();
  const [isAddFoodOpen, setIsAddFoodOpen] = useState(false);
  const [addFoodMealType, setAddFoodMealType] = useState('breakfast');
  const [foodFormDate, setFoodFormDate] = useState(null);
  const [editingFoodLog, setEditingFoodLog] = useState(null);
  const [deletingFoodLog, setDeletingFoodLog] = useState(null);
  const [creationNotice, setCreationNotice] = useState(null);
  const { refreshSession, user } = useAuth();
  const location = useLocation();
  const today = getTodayCalendarDate(currentMoment);
  const selectedDate = resolveCalendarDate(dateSearchParams.get('date'), today);
  const dashboard = useDailyDashboard({
    userId: user?.id,
    selectedDate,
    onUnauthorized: refreshSession,
  });
  const isToday = selectedDate === today;
  const isFutureDate = isFutureCalendarDate(selectedDate, today);
  useEffect(() => {
    if (!creationNotice) return undefined;
    const timer = setTimeout(() => setCreationNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [creationNotice]);

  useEffect(() => {
    if (location.hash !== '#food-log' || dashboard.status !== 'success') return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('food-log')?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dashboard.status, location.hash]);

  function selectDate(nextDate) {
    const nextSearchParams = new URLSearchParams(dateSearchParams);
    if (nextDate === today) nextSearchParams.delete('date');
    else nextSearchParams.set('date', nextDate);
    setCreationNotice(null);
    setDateSearchParams(nextSearchParams, { replace: true });
  }

  function moveDate(dayOffset) {
    selectDate(shiftCalendarDate(selectedDate, dayOffset));
  }

  function handleFoodSaved({ foodLog, previewMatched, operation }) {
    if (!dashboard.refreshDate(foodLog.date)) return;
    setCreationNotice({
      id: `${operation}-${foodLog.id}-${foodLog.updatedAt || foodLog.createdAt}`,
      message: `${foodLog.foodName} ${operation === 'updated' ? 'updated in' : 'added to'} ${mealLabels[foodLog.mealType].toLowerCase()} - ${formatNutritionNumber(foodLog.nutrition.calories)} kcal${
        previewMatched ? '' : ' (saved with server-calculated values)'
      }`,
    });
  }

  function openAddFood(mealType = 'breakfast') {
    setEditingFoodLog(null);
    setAddFoodMealType(mealType);
    setFoodFormDate(selectedDate);
    setIsAddFoodOpen(true);
  }

  function openEditFood(foodLog) {
    if (foodLog.date !== selectedDate) {
      dashboard.retry();
      return;
    }
    setEditingFoodLog(foodLog);
    setAddFoodMealType(foodLog.mealType);
    setFoodFormDate(foodLog.date);
    setIsAddFoodOpen(true);
  }

  function openDeleteFood(foodLog) {
    if (foodLog.date !== selectedDate) {
      dashboard.retry();
      return;
    }
    setDeletingFoodLog(foodLog);
  }

  function closeFoodForm() {
    setIsAddFoodOpen(false);
    setEditingFoodLog(null);
    setFoodFormDate(null);
  }

  function handleFoodDeleted(foodLog) {
    if (!dashboard.refreshDate(foodLog.date)) return;
    setCreationNotice({
      id: `deleted-${foodLog.id}`,
      message: `${foodLog.foodName} deleted from ${mealLabels[foodLog.mealType].toLowerCase()}. Daily totals recalculated.`,
    });
  }

  return (
    <>
      <AuthenticatedAppShell contentId="dashboard-content" onBeforeLogout={dashboard.clear}>
        <section className="dashboard-intro" id="overview">
          <div>
            <p className="dashboard-kicker">{greetingForCurrentTime(currentMoment)}</p>
            <h1>{user?.name?.split(' ')[0]}, here’s your daily lens.</h1>
            <p>Move through your food history one calendar day at a time.</p>
          </div>
          <div className="dashboard-intro-actions">
            <Button type="button" onClick={() => openAddFood()}>
              <Plus size={17} aria-hidden="true" /> Add food
            </Button>
          </div>
        </section>

        <section className="date-navigator" aria-labelledby="selected-date-heading">
          <button type="button" onClick={() => moveDate(-1)} aria-label="View previous day">
            <ChevronLeft size={21} aria-hidden="true" />
          </button>
          <div className="date-navigator-label">
            <span>
              <CalendarDays size={16} aria-hidden="true" />{' '}
              {isToday ? 'Today' : isFutureDate ? 'Future plan' : 'Historical date'}
            </span>
            <h2 id="selected-date-heading">{formatCalendarDate(selectedDate)}</h2>
          </div>
          <button type="button" onClick={() => moveDate(1)} aria-label="View next day">
            <ChevronRight size={21} aria-hidden="true" />
          </button>
          <div className="date-navigator-actions">
            <label>
              <span className="sr-only">Choose a calendar date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => event.target.value && selectDate(event.target.value)}
              />
            </label>
            <Button
              variant="secondary"
              type="button"
              onClick={() => selectDate(today)}
              disabled={isToday}
            >
              Today
            </Button>
          </div>
        </section>

        {dashboard.isLoading ? (
          <DashboardSkeleton />
        ) : dashboard.status === 'error' ? (
          <DashboardError error={dashboard.error} onRetry={dashboard.retry} />
        ) : (
          <div className="dashboard-data" aria-live="polite">
            <NutritionProgressGrid summary={dashboard.summary} />

            <div className="dashboard-content-grid">
              <section className="food-log-shell" id="food-log" aria-labelledby="food-log-heading">
                <div className="dashboard-section-heading">
                  <div>
                    <p className="dashboard-kicker">Selected-date entries</p>
                    <h2 id="food-log-heading">Food log</h2>
                  </div>
                  <div className="dashboard-section-actions">
                    <span>{dashboard.foodLogs.length} total</span>
                    <Button variant="secondary" type="button" onClick={() => openAddFood()}>
                      <Plus size={15} aria-hidden="true" /> Add food
                    </Button>
                  </div>
                </div>

                <DailyMealLog
                  foodLogs={dashboard.foodLogs}
                  mealCalories={dashboard.summary.mealCalories}
                  onAddFood={openAddFood}
                  onEdit={openEditFood}
                  onDelete={openDeleteFood}
                  actionsDisabled={isAddFoodOpen || Boolean(deletingFoodLog)}
                />
              </section>

              <FiberIntakeCard summary={dashboard.summary} />
            </div>
          </div>
        )}
      </AuthenticatedAppShell>

      <AddFoodDialog
        key={editingFoodLog?.id || `create-${addFoodMealType}-${foodFormDate}`}
        open={isAddFoodOpen}
        selectedDate={foodFormDate || selectedDate}
        initialMealType={addFoodMealType}
        foodLog={editingFoodLog}
        onClose={closeFoodForm}
        onCreated={handleFoodSaved}
        onUnauthorized={refreshSession}
        onStale={() => dashboard.refreshDate(foodFormDate || selectedDate)}
      />

      <DeleteFoodDialog
        key={deletingFoodLog?.id || 'delete-closed'}
        open={Boolean(deletingFoodLog)}
        foodLog={deletingFoodLog}
        onClose={() => setDeletingFoodLog(null)}
        onDeleted={handleFoodDeleted}
        onUnauthorized={refreshSession}
        onStale={() => dashboard.refreshDate(deletingFoodLog?.date || selectedDate)}
      />

      {creationNotice && (
        <div className="dashboard-toast-region" key={creationNotice.id}>
          <Toast>{creationNotice.message}</Toast>
        </div>
      )}
    </>
  );
}
