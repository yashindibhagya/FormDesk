import { useParams } from 'react-router-dom'
import { SurveyWizard } from '../components/survey/SurveyWizard'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useSubmissionsStore } from '../store/useSubmissionsStore'

export function EditSurveyPage() {
  const { id } = useParams<{ id: string }>()
  const submissions = useSubmissionsStore((s) => s.submissions)
  const submission = submissions.find((s) => s.id === id)

  if (!submission) {
    return (
      <Card className="text-center">
        <p className="text-slate-600">This submission was not found.</p>
        <div className="mt-4">
          <Button to="/" variant="secondary">
            Back to dashboard
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <SurveyWizard
      mode="edit"
      initialValues={submission.data}
      submissionId={submission.id}
    />
  )
}
