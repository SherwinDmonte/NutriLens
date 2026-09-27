import { AlertCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { foodLogApi } from '../../services/foodLogApi.js';
import { formatFoodQuantity } from '../../utils/mealSections.js';
import { formatNutritionNumber } from '../../utils/nutritionProgress.js';
import { Button } from '../ui/Button.jsx';
import { Dialog } from '../ui/Dialog.jsx';
import { LoadingSpinner } from '../ui/Feedback.jsx';

const mealLabels = Object.freeze({
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
});

export function DeleteFoodDialog({ open, foodLog, onClose, onDeleted, onUnauthorized, onStale }) {
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteLockRef = useRef(false);

  function handleClose() {
    if (deleteLockRef.current) return;
    setError('');
    onClose();
  }

  async function handleDelete(event) {
    event.preventDefault();
    if (!foodLog || deleteLockRef.current) return;

    deleteLockRef.current = true;
    setIsDeleting(true);
    setError('');

    try {
      await foodLogApi.delete(foodLog.id);
      deleteLockRef.current = false;
      setIsDeleting(false);
      onDeleted(foodLog);
      onClose();
    } catch (requestError) {
      if (requestError.status === 401) void onUnauthorized?.();
      if (requestError.status === 404) onStale?.();
      setError(requestError.message || 'The food could not be deleted. Try again.');
      deleteLockRef.current = false;
      setIsDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Delete food?"
      className="delete-food-dialog"
      closeDisabled={isDeleting}
    >
      {foodLog && (
        <form onSubmit={handleDelete}>
          <div className="delete-food-warning" aria-hidden="true">
            <AlertTriangle size={24} />
          </div>
          <p className="delete-food-copy">
            This removes the complete nutrition contribution from the selected day. This action
            cannot be undone.
          </p>
          <div className="delete-food-record">
            <span>{foodLog.foodName.charAt(0)}</span>
            <div>
              <strong>{foodLog.foodName}</strong>
              <small>
                {mealLabels[foodLog.mealType]} -{' '}
                {formatFoodQuantity(foodLog.quantity, foodLog.unit)}
              </small>
            </div>
            <b>{formatNutritionNumber(foodLog.nutrition.calories)} kcal</b>
          </div>

          {error && (
            <div className="delete-food-error" role="alert">
              <AlertCircle size={17} aria-hidden="true" /> {error}
            </div>
          )}

          <footer className="delete-food-actions">
            <Button variant="ghost" type="button" onClick={handleClose} disabled={isDeleting}>
              Keep food
            </Button>
            <Button className="button-danger" type="submit" disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <LoadingSpinner label="Deleting food" /> Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={16} aria-hidden="true" /> Delete food
                </>
              )}
            </Button>
          </footer>
        </form>
      )}
    </Dialog>
  );
}
