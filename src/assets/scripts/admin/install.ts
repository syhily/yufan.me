import { actions } from 'astro:actions'
import { handleActionError, showErrorDialog } from '@/assets/scripts/actions'

const installForm = document.querySelector('form')
if (installForm !== null) {
  installForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    event.stopPropagation()
    const form = new FormData(installForm)

    // Validate the form data
    const name = form.get('name') as string
    if (name === null) {
      return showErrorDialog('The user name is required')
    }
    const email = form.get('email') as string
    if (email === null) {
      return showErrorDialog('The email is required')
    }
    const password = form.get('password') as string
    if (password === null) {
      return showErrorDialog('The password is required')
    }

    const { error } = await actions.auth.signUpAdmin({ name, email, password })
    if (error) {
      return handleActionError(error)
    }
    return (location.href = '/admin/login')
  })
}
