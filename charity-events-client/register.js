document.addEventListener('DOMContentLoaded', async () => {
  const eventInfoContainer = document.getElementById('event-info');
  const registrationForm = document.getElementById('registration-form');
  const successMessage = document.getElementById('success-message');
  const errorMessage = document.getElementById('error-message');
  
  // 从URL获取eventId
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('eventId');
  
  if (!eventId) {
    errorMessage.textContent = 'No event specified.';
    return;
  }
  
  let eventData;
  
  // 获取活动信息
  try {
    eventData = await api.getEventById(eventId);
    renderEventInfo(eventData);
  } catch (error) {
    errorMessage.textContent = `Error loading event: ${error.message}`;
    return;
  }
  
  // 渲染活动信息
  function renderEventInfo(event) {
    eventInfoContainer.innerHTML = `
      <h2>${event.event_name}</h2>
      <p><strong>Date & Time:</strong> ${new Date(event.event_date).toLocaleString()}</p >
      <p><strong>Location:</strong> ${event.event_location}</p >
      <p><strong>Ticket Price:</strong> $${event.ticket_price.toFixed(2)}</p >
    `;
  }
  
  // 处理表单提交
  registrationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.textContent = '';
    successMessage.style.display = 'none';
    
    const formData = {
      event_id: eventId,
      full_name: document.getElementById('fullName').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      ticket_quantity: parseInt(document.getElementById('ticketQuantity').value)
    };
    
    try {
      await api.registerForEvent(formData);
      successMessage.textContent = 'Registration successful! Thank you for your support.';
      successMessage.style.display = 'block';
      registrationForm.reset();
      
      // 3秒后跳转到活动详情页
      setTimeout(() => {
        window.location.href = `event-detail.html?eventId=${eventId}`;
      }, 3000);
    } catch (error) {
      errorMessage.textContent = `Registration failed: ${error.message}`;
    }
  });
});