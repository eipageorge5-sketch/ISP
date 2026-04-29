function selectPlan(planId, price) {
    // Remove active class from all
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // Add to clicked one
    event.currentTarget.classList.add('active');
    
    console.log(`User selected ${planId} for KSh ${price}`);
    // Later, we will use this to update the backend payment request
}
