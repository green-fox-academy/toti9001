import { Component } from '@angular/core';
import { EnvService } from './env.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  constructor(
    private env: EnvService,
  ) {}

}